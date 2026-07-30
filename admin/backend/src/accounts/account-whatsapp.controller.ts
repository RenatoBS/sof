import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { WhatsappUazapiService } from '../whatsapp/whatsapp-uazapi.service';

function toDataUrlQr(qrcode?: string) {
  if (!qrcode) return undefined;
  const trimmed = qrcode.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `data:image/png;base64,${trimmed.replace(/^data:image\/\w+;base64,/, '')}`;
}

function isInvalidTokenError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('(401)') ||
    /invalid token/i.test(msg) ||
    /unauthorized/i.test(msg)
  );
}

function mapUazapiError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (isInvalidTokenError(err)) {
    throw new BadRequestException({
      error:
        'Token da instância inválido. Use Recriar instância e conecte de novo.',
    });
  }
  throw new BadGatewayException({
    error: msg.slice(0, 300) || 'Falha ao falar com o Uazapi.',
  });
}

@Controller('api/accounts/:id/whatsapp')
@UseGuards(AdminAuthGuard)
export class AccountWhatsappAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly api: WhatsappUazapiService,
  ) {}

  private ensurePairing() {
    if (!this.api.isPairingAvailable()) {
      throw new ServiceUnavailableException({
        error:
          'Uazapi não configurado no admin-api. Defina WHATSAPP_BASE_URL e WHATSAPP_ADMIN_TOKEN (ou WHATSAPP_TOKEN).',
      });
    }
  }

  private webhookCallbackUrl() {
    const base = (
      this.config.get<string>('apiPublicUrl') || 'http://localhost:3001'
    ).replace(/\/+$/, '');
    return `${base}/api/whatsapp/webhook`;
  }

  private async getAccount(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException({ error: 'Conta não encontrada.' });
    return account;
  }

  private async clearInstance(accountId: string) {
    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        whatsappInstanceToken: '',
        whatsappPhoneNumberId: '',
        whatsappConnectedAt: null,
      },
    });
  }

  private async ensureInstance(
    accountId: string,
    opts?: { forceNew?: boolean },
  ) {
    let account = await this.getAccount(accountId);

    if (opts?.forceNew && account.whatsappInstanceToken) {
      account = await this.clearInstance(accountId);
    }

    if (account.whatsappInstanceToken) {
      return account;
    }

    const legacyToken = this.api.legacyInstanceToken();
    const legacyId = this.api.legacyInstanceKey();

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
        if (!legacyToken) mapUazapiError(err);
        console.warn(
          '[admin-whatsapp] create falhou — legado:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (!legacyToken) {
      throw new ServiceUnavailableException({
        error:
          'Sem WHATSAPP_ADMIN_TOKEN válido nem WHATSAPP_TOKEN — impossível criar/parear.',
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

  @Get()
  async status(@Param('id') id: string) {
    const account = await this.getAccount(id);
    const pairingAvailable = this.api.isPairingAvailable();
    const hasInstance = Boolean(account.whatsappInstanceToken);
    const base = {
      pairingAvailable,
      hasInstance,
      instanceId: account.whatsappPhoneNumberId || '',
      connected: Boolean(account.whatsappConnectedAt),
      connectedAt: account.whatsappConnectedAt?.toISOString() ?? null,
      liveStatus: null as string | null,
      phone: null as string | null,
      qrcode: null as string | null,
      paircode: null as string | null,
    };

    if (!hasInstance || !pairingAvailable) {
      return base;
    }

    try {
      const live = await this.api.instanceStatus(account.whatsappInstanceToken);
      const connected = live.status === 'connected';
      if (connected && !account.whatsappConnectedAt) {
        await this.prisma.account.update({
          where: { id },
          data: { whatsappConnectedAt: new Date() },
        });
        try {
          await this.api.configureWebhook(
            this.webhookCallbackUrl(),
            account.whatsappInstanceToken,
          );
        } catch (err) {
          console.warn(
            '[admin-whatsapp] webhook sync falhou:',
            err instanceof Error ? err.message : err,
          );
        }
      } else if (!connected && account.whatsappConnectedAt) {
        await this.prisma.account.update({
          where: { id },
          data: { whatsappConnectedAt: null },
        });
      }

      return {
        ...base,
        connected,
        connectedAt: connected
          ? (account.whatsappConnectedAt || new Date()).toISOString()
          : null,
        liveStatus: live.status,
        phone: live.phone || null,
        instanceId: live.instanceId || account.whatsappPhoneNumberId || '',
        qrcode: toDataUrlQr(live.qrcode) || null,
        paircode: live.paircode || null,
      };
    } catch (err) {
      if (isInvalidTokenError(err)) {
        return { ...base, liveStatus: 'invalid_token' };
      }
      mapUazapiError(err);
    }
  }

  @Post('connect')
  async connect(
    @Param('id') id: string,
    @Body() body: { phone?: string },
  ) {
    this.ensurePairing();
    await this.getAccount(id);

    const phone =
      typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    if (body?.phone && phone.length < 10) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDI (ex: 5511999998888).',
      });
    }

    const run = async (forceNew = false) => {
      const account = await this.ensureInstance(id, { forceNew });
      const result = await this.api.connectInstance(
        account.whatsappInstanceToken,
        phone || undefined,
      );
      const instanceId =
        result.instanceId || account.whatsappPhoneNumberId || '';
      if (instanceId && instanceId !== account.whatsappPhoneNumberId) {
        await this.prisma.account.update({
          where: { id },
          data: { whatsappPhoneNumberId: instanceId },
        });
      }
      if (result.status === 'connected') {
        await this.prisma.account.update({
          where: { id },
          data: { whatsappConnectedAt: new Date() },
        });
        try {
          await this.api.configureWebhook(
            this.webhookCallbackUrl(),
            account.whatsappInstanceToken,
          );
        } catch (err) {
          console.warn(
            '[admin-whatsapp] webhook após connect:',
            err instanceof Error ? err.message : err,
          );
        }
      }
      return {
        status: result.status,
        instanceId,
        qrcode: phone ? undefined : toDataUrlQr(result.qrcode),
        paircode: phone ? result.paircode || null : null,
        mode: phone ? ('paircode' as const) : ('qrcode' as const),
      };
    };

    try {
      return await run(false);
    } catch (err) {
      if (isInvalidTokenError(err) && this.api.isAdminConfigured()) {
        try {
          return await run(true);
        } catch (retryErr) {
          mapUazapiError(retryErr);
        }
      }
      mapUazapiError(err);
    }
  }

  @Post('disconnect')
  async disconnect(@Param('id') id: string) {
    this.ensurePairing();
    const account = await this.getAccount(id);
    if (account.whatsappInstanceToken) {
      try {
        await this.api.disconnectInstance(account.whatsappInstanceToken);
      } catch (err) {
        console.warn(
          '[admin-whatsapp] disconnect Uazapi:',
          err instanceof Error ? err.message : err,
        );
      }
    }
    await this.prisma.account.update({
      where: { id },
      data: { whatsappConnectedAt: null },
    });
    return { ok: true };
  }

  @Post('clear')
  async clear(@Param('id') id: string) {
    await this.getAccount(id);
    await this.prisma.account.update({
      where: { id },
      data: { whatsappConnectedAt: null },
    });
    return { ok: true };
  }

  @Post('recreate')
  async recreate(@Param('id') id: string) {
    this.ensurePairing();
    if (!this.api.isAdminConfigured()) {
      throw new ServiceUnavailableException({
        error: 'Recriar exige WHATSAPP_ADMIN_TOKEN no admin-api.',
      });
    }
    const account = await this.getAccount(id);
    if (account.whatsappInstanceToken) {
      try {
        await this.api.disconnectInstance(account.whatsappInstanceToken);
      } catch {
        /* best-effort */
      }
    }
    await this.clearInstance(id);
    const created = await this.ensureInstance(id, { forceNew: false });
    return {
      ok: true,
      instanceId: created.whatsappPhoneNumberId,
      hasInstance: Boolean(created.whatsappInstanceToken),
    };
  }
}
