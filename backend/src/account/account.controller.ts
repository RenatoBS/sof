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
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';
import { parseOpeningHoursInput } from './opening-hours';
import {
  ACCOUNT_TIMEZONES,
  DEFAULT_ACCOUNT_TIMEZONE,
  normalizeAccountTimezone,
  normalizeReminderLeadMinutes,
  REMINDER_LEAD_MINUTES,
} from '../reminders/reminder-window';

@Controller('api/account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly whatsappApi: WhatsappApiService,
  ) {}

  @Put()
  async update(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      businessName?: string;
      whatsappPhoneNumberId?: string;
      openingHours?: unknown;
      address?: string;
      whatsappReminderMinutes?: number;
      timezone?: string;
    },
  ) {
    const data: {
      businessName?: string;
      whatsappPhoneNumberId?: string;
      openingHours?: Prisma.InputJsonValue;
      address?: string;
      whatsappReminderMinutes?: number;
      timezone?: string;
    } = {};

    if (typeof body?.businessName === 'string') {
      const businessName = body.businessName.trim();
      if (businessName) data.businessName = businessName;
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

    const account = await this.prisma.account.update({
      where: { id: req.account.id },
      data,
    });
    return { account: publicAccount(account) };
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
