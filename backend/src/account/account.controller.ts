import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { publicAccount } from '../common/public-shapes';
import { isValidPhone, normalizePhone } from '../common/phone';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';
import { parseOpeningHoursInput } from './opening-hours';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  ACCOUNT_TIMEZONES,
  DEFAULT_ACCOUNT_TIMEZONE,
  normalizeAccountTimezone,
  normalizeReminderLeadMinutes,
  REMINDER_LEAD_MINUTES,
} from '../reminders/reminder-window';

function parseAccountBotPause(body: {
  botPausedPermanent?: boolean;
  botPausedUntil?: string | null;
}):
  | { botPausedPermanent: boolean; botPausedUntil: Date | null }
  | { error: string } {
  if (
    body.botPausedPermanent === undefined &&
    body.botPausedUntil === undefined
  ) {
    return { error: 'noop' };
  }
  const permanent = Boolean(body.botPausedPermanent);
  if (permanent) {
    return { botPausedPermanent: true, botPausedUntil: null };
  }
  if (body.botPausedUntil === null || body.botPausedUntil === '') {
    return { botPausedPermanent: false, botPausedUntil: null };
  }
  if (body.botPausedUntil === undefined) {
    return { botPausedPermanent: false, botPausedUntil: null };
  }
  const until = new Date(String(body.botPausedUntil));
  if (Number.isNaN(until.getTime())) {
    return { error: 'Data de pausa do bot inválida.' };
  }
  if (until.getTime() <= Date.now()) {
    return { botPausedPermanent: false, botPausedUntil: null };
  }
  return { botPausedPermanent: false, botPausedUntil: until };
}

@Controller('api/account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Put()
  async update(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      businessName?: string;
      phone?: string;
      whatsappPhoneNumberId?: string;
      openingHours?: unknown;
      address?: string;
      whatsappReminderMinutes?: number;
      timezone?: string;
      botPausedPermanent?: boolean;
      botPausedUntil?: string | null;
    },
  ) {
    const data: {
      businessName?: string;
      phone?: string;
      whatsappPhoneNumberId?: string;
      openingHours?: Prisma.InputJsonValue;
      address?: string;
      whatsappReminderMinutes?: number;
      timezone?: string;
      botPausedPermanent?: boolean;
      botPausedUntil?: Date | null;
    } = {};

    if (typeof body?.businessName === 'string') {
      const businessName = body.businessName.trim();
      if (businessName) data.businessName = businessName;
    }
    if (body?.phone !== undefined) {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) {
        throw new BadRequestException({
          error: 'Informe um telefone válido com DDD (somente números).',
        });
      }
      data.phone = phone;
    }
    if (typeof body?.whatsappPhoneNumberId === 'string') {
      data.whatsappPhoneNumberId = body.whatsappPhoneNumberId.trim();
    }
    if (typeof body?.address === 'string') {
      data.address = body.address.trim().slice(0, 500);
    }
    if (body?.openingHours !== undefined) {
      const parsed = parseOpeningHoursInput(body.openingHours);
      if ('error' in parsed) {
        throw new BadRequestException({ error: parsed.error });
      }
      data.openingHours = parsed.hours as Prisma.InputJsonValue;
    }
    if (body?.whatsappReminderMinutes !== undefined) {
      const lead = normalizeReminderLeadMinutes(body.whatsappReminderMinutes);
      if (lead === null) {
        throw new BadRequestException({
          error: `Antecedência inválida. Use: ${REMINDER_LEAD_MINUTES.join(', ')} minutos.`,
        });
      }
      if (lead > 0) {
        await this.entitlements.assertFeature(req.account.id, 'reminders');
      }
      data.whatsappReminderMinutes = lead;
    }
    if (body?.timezone !== undefined) {
      const timezone = normalizeAccountTimezone(body.timezone);
      if (!timezone) {
        throw new BadRequestException({
          error: `Fuso horário inválido. Preferidos: ${ACCOUNT_TIMEZONES.join(', ')}.`,
        });
      }
      data.timezone = timezone || DEFAULT_ACCOUNT_TIMEZONE;
    }

    if (
      body?.botPausedPermanent !== undefined ||
      body?.botPausedUntil !== undefined
    ) {
      const pause = parseAccountBotPause(body);
      if ('error' in pause && pause.error !== 'noop') {
        throw new BadRequestException({ error: pause.error });
      }
      if (!('error' in pause)) {
        const enabling =
          pause.botPausedPermanent || pause.botPausedUntil != null;
        if (enabling) {
          await this.entitlements.assertFeature(req.account.id, 'botPause');
        }
        data.botPausedPermanent = pause.botPausedPermanent;
        data.botPausedUntil = pause.botPausedUntil;
      }
    }

    const account = await this.prisma.account.update({
      where: { id: req.account.id },
      data,
    });
    const entitlements = await this.entitlements.forAccount(account.id);
    return { account: { ...publicAccount(account), entitlements } };
  }

  @Get('integrations')
  integrations(@Req() req: AuthedRequest) {
    const stripeKey = this.config.get<string>('stripe.secretKey') || '';
    const waProvider = this.whatsappApi.provider();
    const waConfigured = this.whatsappApi.isConfigured();
    const hasInstance = Boolean(
      req.account.whatsappInstanceToken || req.account.whatsappPhoneNumberId,
    );
    return {
      stripe: { configured: Boolean(stripeKey) },
      whatsapp: {
        configured: waConfigured,
        provider: waProvider,
        linkedPhoneNumberId: req.account.whatsappPhoneNumberId || '',
        linked: Boolean(req.account.whatsappConnectedAt),
        hasInstance,
        pairingAvailable: this.whatsappApi.isPairingAvailable(),
      },
    };
  }
}
