import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';

function toDataUrlQr(qrcode?: string) {
  if (!qrcode) return undefined;
  const trimmed = qrcode.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // base64 puro → PNG data URL
  return `data:image/png;base64,${trimmed.replace(/^data:image\/\w+;base64,/, '')}`;
}

@Controller('api/account/whatsapp')
@UseGuards(AuthGuard)
export class AccountWhatsappController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly api: WhatsappApiService,
  ) {}

  private ensureUazapiPairing() {
    if (this.api.provider() !== 'uazapi') {
      throw new BadRequestException({
        error:
          'Pareamento por QR/código exige WHATSAPP_PROVIDER=uazapi (Uazapi).',
      });
    }
    if (!this.api.isPairingAvailable()) {
      throw new ServiceUnavailableException({
        error:
          'Uazapi não configurado. Defina WHATSAPP_BASE_URL e WHATSAPP_ADMIN_TOKEN (multi-conta) ou WHATSAPP_TOKEN (instância única).',
      });
    }
  }

  private webhookCallbackUrl() {
    const base = (
      this.config.get<string>('apiPublicUrl') || 'http://localhost:3001'
    ).replace(/\/+$/, '');
    return `${base}/api/whatsapp/webhook`;
  }

  private async ensureInstance(accountId: string) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });

    if (account.whatsappInstanceToken) {
      return account;
    }

    const legacyToken = this.api.legacyInstanceToken();
    const legacyId = this.api.instanceKey();

    // Multi-tenant: cria instância nova via admin token.
    if (this.api.isAdminConfigured()) {
      try {
        const name = `sof-${accountId.slice(-8)}`;
        const created = await this.api.createInstance(name);

        return this.prisma.account.update({
          where: { id: accountId },
          data: {
            whatsappInstanceToken: created.token,
            whatsappPhoneNumberId: created.instanceId,
            whatsappConnectedAt: null,
          },
        });
      } catch (err) {
        if (!legacyToken) throw err;
        console.warn(
          '[whatsapp] Admin token rejeitado — usando WHATSAPP_TOKEN legado:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Legado: reusa a instância única do .env.
    if (!legacyToken) {
      throw new ServiceUnavailableException({
        error:
          'Sem WHATSAPP_ADMIN_TOKEN válido nem WHATSAPP_TOKEN — impossível criar/parear instância.',
      });
    }

    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        whatsappInstanceToken: legacyToken,
        whatsappPhoneNumberId: legacyId || account.whatsappPhoneNumberId,
        whatsappConnectedAt: null,
      },
    });
  }

  @Post('connect')
  async connect(
    @Req() req: AuthedRequest,
    @Body() body: { phone?: string },
  ) {
    this.ensureUazapiPairing();

    const phone =
      typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    if (body?.phone && phone.length < 10) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDI (ex: 5511999998888).',
      });
    }

    const account = await this.ensureInstance(req.account.id);
    const result = await this.api.connectInstance(
      account.whatsappInstanceToken,
      phone || undefined,
    );

    const instanceId =
      result.instanceId || account.whatsappPhoneNumberId || '';
    if (instanceId && instanceId !== account.whatsappPhoneNumberId) {
      await this.prisma.account.update({
        where: { id: account.id },
        data: { whatsappPhoneNumberId: instanceId },
      });
    }

    return {
      status: result.status,
      instanceId: instanceId || account.whatsappPhoneNumberId,
      qrcode: phone ? undefined : toDataUrlQr(result.qrcode),
      paircode: phone ? result.paircode || null : null,
      mode: phone ? 'paircode' : 'qrcode',
    };
  }

  @Get('status')
  async status(@Req() req: AuthedRequest) {
    this.ensureUazapiPairing();

    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: req.account.id },
    });

    if (!account.whatsappInstanceToken) {
      return {
        status: 'disconnected' as const,
        linked: false,
        instanceId: '',
        phone: null,
        qrcode: null,
        paircode: null,
        connectedAt: null,
      };
    }

    const live = await this.api.instanceStatus(account.whatsappInstanceToken);
    const linked = live.status === 'connected';

    if (linked && !account.whatsappConnectedAt) {
      const callbackUrl = this.webhookCallbackUrl();
      try {
        await this.api.configureUazapiWebhook(
          callbackUrl,
          account.whatsappInstanceToken,
        );
      } catch (err) {
        console.warn(
          '[whatsapp] Falha ao configurar webhook após conexão:',
          err instanceof Error ? err.message : err,
        );
      }

      const instanceId =
        live.instanceId || account.whatsappPhoneNumberId || '';
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          whatsappConnectedAt: new Date(),
          ...(instanceId ? { whatsappPhoneNumberId: instanceId } : {}),
        },
      });
    }

    if (!linked && account.whatsappConnectedAt) {
      await this.prisma.account.update({
        where: { id: account.id },
        data: { whatsappConnectedAt: null },
      });
    }

    return {
      status: live.status,
      linked,
      instanceId: live.instanceId || account.whatsappPhoneNumberId || '',
      phone: live.phone || null,
      qrcode: toDataUrlQr(live.qrcode) || null,
      paircode: live.paircode || null,
      connectedAt: linked
        ? (account.whatsappConnectedAt || new Date()).toISOString()
        : null,
    };
  }

  @Post('disconnect')
  async disconnect(@Req() req: AuthedRequest) {
    this.ensureUazapiPairing();

    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: req.account.id },
    });

    if (!account.whatsappInstanceToken) {
      return { ok: true, status: 'disconnected' as const };
    }

    try {
      await this.api.disconnectInstance(account.whatsappInstanceToken);
    } catch (err) {
      console.warn(
        '[whatsapp] disconnect Uazapi:',
        err instanceof Error ? err.message : err,
      );
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: { whatsappConnectedAt: null },
    });

    return { ok: true, status: 'disconnected' as const };
  }
}
