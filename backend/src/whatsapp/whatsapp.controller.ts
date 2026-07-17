import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { WhatsappApiService } from './whatsapp-api.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { isDuplicateWebhook, webhookDedupeKey } from './webhook-dedupe';

type MetaWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          type?: string;
          from?: string;
          text?: { body?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
          button?: { payload?: string; text?: string };
        }>;
      };
    }>;
  }>;
};

type UazapiWebhookBody = {
  EventType?: string;
  event?: string;
  BaseUrl?: string;
  owner?: string;
  token?: string;
  message?: {
    id?: string;
    messageid?: string;
    messageId?: string;
    key?: { id?: string };
    fromMe?: boolean;
    wasSentByApi?: boolean;
    source?: string;
    isGroup?: boolean;
    text?: string;
    content?: string;
    type?: string;
    messageType?: string;
    sender?: string;
    sender_pn?: string;
    chatid?: string;
    buttonOrListid?: string;
    selectedId?: string;
    selectedButtonId?: string;
    listResponse?: { id?: string; title?: string; description?: string };
    buttonResponse?: { id?: string; title?: string };
    interactive?: {
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string };
    };
  };
  chat?: {
    phone?: string;
    wa_chatid?: string;
    wa_isGroup?: boolean;
  };
};

@Controller('api/whatsapp')
export class WhatsappController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly api: WhatsappApiService,
    private readonly bot: WhatsappBotService,
  ) {}

  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = this.config.get<string>('whatsapp.verifyToken') || '';
    if (mode === 'subscribe' && expected && verifyToken === expected) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  @Post('webhook')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60 * 1000 } })
  async webhook(@Req() req: Request, @Res({ passthrough: true }) _res: Response) {
    const { valid, skipped } = this.api.verifySignature(
      req as Request & { rawBody?: Buffer },
    );
    if (!valid) {
      console.warn(
        '[whatsapp] Assinatura inválida no webhook, ignorando payload.',
      );
      throw new UnauthorizedException();
    }
    if (skipped && this.api.provider() === 'meta') {
      console.warn(
        '[whatsapp] WHATSAPP_APP_SECRET não configurado — assinatura não verificada.',
      );
    }

    setImmediate(() => {
      void this.processWebhook(req.body).catch((err) => {
        console.error('[whatsapp] Erro processando webhook:', err);
      });
    });
  }

  private async processWebhook(body: MetaWebhookBody & UazapiWebhookBody) {
    if (this.api.provider() === 'uazapi' || this.isUazapiPayload(body)) {
      await this.processUazapiWebhook(body);
      return;
    }
    await this.processMetaWebhook(body);
  }

  private isUazapiPayload(body: UazapiWebhookBody) {
    const event = body?.EventType || body?.event;
    return Boolean(event || body?.message?.chatid || body?.BaseUrl);
  }

  private async processUazapiWebhook(body: UazapiWebhookBody) {
    const event = String(body?.EventType || body?.event || '').toLowerCase();
    // Só mensagens novas — ignora updates/acks/connection que o Uazapi às vezes reenvia.
    if (event && event !== 'messages' && event !== 'message') {
      return;
    }

    const message = body?.message;
    if (!message) return;
    if (message.fromMe || message.wasSentByApi) return;
    if (message.source === 'api' || message.source === 'system') return;
    if (message.isGroup || body?.chat?.wa_isGroup) return;

    const text = this.extractUazapiSelection(message);
    if (!text) return;

    const customerPhone = this.extractPhone(
      message.sender_pn ||
        body?.chat?.phone ||
        message.sender ||
        message.chatid ||
        body?.chat?.wa_chatid ||
        '',
    );
    if (!customerPhone) return;

    const messageId =
      message.id ||
      message.messageid ||
      message.messageId ||
      message.key?.id ||
      '';
    const dedupeKey = webhookDedupeKey({
      messageId,
      token: body?.token,
      phone: customerPhone,
      text,
      event,
    });
    if (isDuplicateWebhook(dedupeKey)) {
      console.warn(`[whatsapp] Webhook duplicado ignorado (${dedupeKey.slice(0, 48)})`);
      return;
    }

    const account = await this.resolveAccount({
      instanceKey: this.api.instanceKey(),
      owner: body?.owner,
      token: body?.token,
    });
    if (!account) {
      console.warn(
        '[whatsapp] Conta não encontrada para a instância Uazapi — pareie o WhatsApp em Conta.',
      );
      return;
    }

    const result = await this.bot.handleIncomingMessage({
      account,
      customerPhone,
      text,
    });
    await this.dispatchBotReplies(
      customerPhone,
      result,
      account.whatsappInstanceToken,
    );
  }

  private extractUazapiSelection(
    message: NonNullable<UazapiWebhookBody['message']>,
  ): string {
    const fromInteractive =
      message.buttonOrListid ||
      message.selectedId ||
      message.selectedButtonId ||
      message.listResponse?.id ||
      message.buttonResponse?.id ||
      message.interactive?.button_reply?.id ||
      message.interactive?.list_reply?.id ||
      '';
    if (fromInteractive) return String(fromInteractive).trim();

    const fromTitle =
      message.listResponse?.title ||
      message.buttonResponse?.title ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '';
    if (fromTitle) return String(fromTitle).trim();

    return String(message.text || message.content || '').trim();
  }

  private async dispatchBotReplies(
    customerPhone: string,
    result: Awaited<ReturnType<WhatsappBotService['handleIncomingMessage']>>,
    instanceToken?: string,
  ) {
    const menus = result.interactive || [];
    if (menus.length > 0) {
      for (const menu of menus) {
        try {
          await this.api.sendMenu(customerPhone, menu, instanceToken);
        } catch (err) {
          console.error(
            '[whatsapp] Falha ao enviar menu, caindo para texto:',
            err instanceof Error ? err.message : err,
          );
          for (const reply of result.replies) {
            await this.api
              .sendText(customerPhone, reply, instanceToken)
              .catch((sendErr) => {
                console.error(
                  '[whatsapp] Falha ao enviar resposta:',
                  sendErr.message,
                );
              });
          }
        }
      }
      return;
    }

    for (const reply of result.replies) {
      await this.api
        .sendText(customerPhone, reply, instanceToken)
        .catch((err) => {
          console.error('[whatsapp] Falha ao enviar resposta:', err.message);
        });
    }
  }

  private async processMetaWebhook(body: MetaWebhookBody) {
    const entries = body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        const account = phoneNumberId
          ? await this.prisma.account.findFirst({
              where: { whatsappPhoneNumberId: phoneNumberId },
            })
          : null;

        for (const message of value.messages || []) {
          if (!account || !message.from) continue;
          const text = this.extractMetaSelection(message);
          if (!text) continue;
          const result = await this.bot.handleIncomingMessage({
            account,
            customerPhone: message.from,
            text,
          });
          await this.dispatchBotReplies(message.from, result);
        }
      }
    }
  }

  private extractMetaSelection(message: {
    type?: string;
    text?: { body?: string };
    interactive?: {
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string };
    };
    button?: { payload?: string; text?: string };
  }): string {
    if (message.type === 'interactive') {
      const reply =
        message.interactive?.button_reply || message.interactive?.list_reply;
      return String(reply?.id || reply?.title || '').trim();
    }
    if (message.type === 'button') {
      return String(
        message.button?.payload || message.button?.text || '',
      ).trim();
    }
    if (message.type === 'text') {
      return String(message.text?.body || '').trim();
    }
    return '';
  }

  private extractPhone(raw: string) {
    const digits = String(raw || '').replace(/\D/g, '');
    return digits || '';
  }

  private async resolveAccount(opts: {
    instanceKey: string;
    owner?: string;
    token?: string;
  }) {
    // Preferir token da instância persistido na conta (multi-tenant).
    if (opts.token) {
      const byToken = await this.prisma.account.findFirst({
        where: { whatsappInstanceToken: opts.token },
      });
      if (byToken) return byToken;
    }

    const keys = [
      opts.instanceKey,
      this.extractPhone(opts.owner || ''),
      opts.token,
    ].filter(Boolean);

    for (const key of keys) {
      const account = await this.prisma.account.findFirst({
        where: { whatsappPhoneNumberId: key },
      });
      if (account) return account;
    }

    // Instância única legada: token do webhook = WHATSAPP_TOKEN do .env
    const envToken = this.config.get<string>('whatsapp.token') || '';
    if (opts.token && envToken && opts.token === envToken) {
      if (opts.instanceKey) {
        const linked = await this.prisma.account.findFirst({
          where: { whatsappPhoneNumberId: opts.instanceKey },
        });
        if (linked) return linked;
      }
      return this.prisma.account.findFirst({
        where: { whatsappPhoneNumberId: { not: '' } },
      });
    }
    return null;
  }

  @Post('simulate')
  @UseGuards(AuthGuard)
  async simulate(
    @Req() req: AuthedRequest,
    @Body() body: { customerPhone?: string; message?: string },
  ) {
    const customerPhone = String(
      body?.customerPhone || '5511999990000',
    ).trim();
    const text = String(body?.message || '').trim();
    if (!text) {
      throw new BadRequestException({
        error: 'Informe uma mensagem para simular.',
      });
    }

    return this.bot.handleIncomingMessage({
      account: req.account,
      customerPhone,
      text,
    });
  }
}
