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
    if (skipped) {
      console.warn(
        '[whatsapp] WHATSAPP_APP_SECRET não configurado — assinatura não verificada.',
      );
    }

    // Responde 200 via HttpCode; processa o resto sem bloquear a Meta.
    setImmediate(() => {
      void this.processWebhook(req.body).catch((err) => {
        console.error('[whatsapp] Erro processando webhook:', err);
      });
    });
  }

  private async processWebhook(body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          messages?: Array<{
            type?: string;
            from?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  }) {
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
          if (message.type !== 'text' || !account || !message.from) continue;
          const customerPhone = message.from;
          const text = message.text?.body || '';
          const { replies } = await this.bot.handleIncomingMessage({
            account,
            customerPhone,
            text,
          });
          for (const reply of replies) {
            await this.api.sendText(customerPhone, reply).catch((err) => {
              console.error('[whatsapp] Falha ao enviar resposta:', err.message);
            });
          }
        }
      }
    }
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
