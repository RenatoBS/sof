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
    },
  ) {
    const data: {
      businessName?: string;
      whatsappPhoneNumberId?: string;
      openingHours?: Prisma.InputJsonValue;
      address?: string;
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
