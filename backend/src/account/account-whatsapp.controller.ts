import {
  BadGatewayException,
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
import { EntitlementsService } from '../entitlements/entitlements.service';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';

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
        'Token da instância WhatsApp inválido. Tente conectar de novo para criar uma instância nova.',
    });
  }
  throw new BadGatewayException({
    error: msg.slice(0, 300) || 'Falha ao falar com o Uazapi.',
  });
}

const WEBHOOK_RESYNC_MS = 60 * 60 * 1000;

@Controller('api/account/whatsapp')
@UseGuards(AuthGuard)
export class AccountWhatsappController {
  /** Última sincronização de webhook por instância (evita reconfigurar a cada poll). */
  private readonly webhookSyncedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly api: WhatsappApiService,
    private readonly entitlements: EntitlementsService,
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
    let account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });

    if (opts?.forceNew && account.whatsappInstanceToken) {
      account = await this.clearInstance(accountId);
    }

    if (account.whatsappInstanceToken) {
      return account;
    }

    const legacyToken = this.api.legacyInstanceToken();
    const legacyId = this.api.instanceKey();

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
          '[whatsapp] Admin create falhou — tentando WHATSAPP_TOKEN legado:',
          err instanceof Error ? err.message : err,
        );
      }
    }

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

    const ents = await this.entitlements.forAccount(req.account.id);
    const waLimit = this.entitlements.effectiveWhatsappLimit(ents);
    const alreadyLinked = Boolean(
      req.account.whatsappConnectedAt ||
        req.account.whatsappInstanceToken ||
        req.account.whatsappPhoneNumberId,
    );
    if (!alreadyLinked && waLimit < 1) {
      await this.entitlements.assertLimit(req.account.id, 'maxWhatsappNumbers', 0);
    }

    const phone =
      typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    if (body?.phone && phone.length < 10) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDI (ex: 5511999998888).',
      });
    }

    const run = async (forceNew = false) => {
      const account = await this.ensureInstance(req.account.id, { forceNew });
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
        mode: phone ? ('paircode' as const) : ('qrcode' as const),
      };
    };

    try {
      return await run(false);
    } catch (err) {
      if (isInvalidTokenError(err) && this.api.isAdminConfigured()) {
        console.warn(
          '[whatsapp] Token inválido no connect — recriando instância via admin.',
        );
        try {
          return await run(true);
        } catch (retryErr) {
          mapUazapiError(retryErr);
        }
      }
      mapUazapiError(err);
    }
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

    let live;
    try {
      live = await this.api.instanceStatus(account.whatsappInstanceToken);
    } catch (err) {
      if (isInvalidTokenError(err)) {
        console.warn(
          '[whatsapp] Token inválido no status — limpando vínculo da conta.',
        );
        await this.clearInstance(account.id);
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
      mapUazapiError(err);
    }

    const linked = live.status === 'connected';

    if (linked) {
      // Garante o webhook com a config atual (action: replace é idempotente),
      // no máx. 1x/hora por instância. Cobre instâncias pareadas antes de
      // mudanças na config — ex. permitir fromMe p/ detectar resposta humana.
      const token = account.whatsappInstanceToken;
      const last = this.webhookSyncedAt.get(token) || 0;
      if (Date.now() - last > WEBHOOK_RESYNC_MS) {
        try {
          await this.api.configureUazapiWebhook(
            this.webhookCallbackUrl(),
            token,
          );
          this.webhookSyncedAt.set(token, Date.now());
        } catch (err) {
          console.warn(
            '[whatsapp] Falha ao configurar webhook após conexão:',
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    if (linked && !account.whatsappConnectedAt) {
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
