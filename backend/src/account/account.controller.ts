import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { publicAccount } from '../common/public-shapes';

@Controller('api/account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Put()
  async update(
    @Req() req: AuthedRequest,
    @Body()
    body: { businessName?: string; whatsappPhoneNumberId?: string },
  ) {
    const data: { businessName?: string; whatsappPhoneNumberId?: string } = {};
    if (typeof body?.businessName === 'string') {
      const businessName = body.businessName.trim();
      if (businessName) data.businessName = businessName;
    }
    if (typeof body?.whatsappPhoneNumberId === 'string') {
      data.whatsappPhoneNumberId = body.whatsappPhoneNumberId.trim();
    }

    const account = await this.prisma.account.update({
      where: { id: req.account.id },
      data,
    });
    return { account: publicAccount(account) };
  }

  @Get('integrations')
  integrations(@Req() req: AuthedRequest) {
    const mpToken = this.config.get<string>('mercadoPago.accessToken') || '';
    const waToken = this.config.get<string>('whatsapp.token') || '';
    const waPhone = this.config.get<string>('whatsapp.phoneNumberId') || '';
    return {
      mercadoPago: { configured: Boolean(mpToken) },
      whatsapp: {
        configured: Boolean(waToken && waPhone),
        linkedPhoneNumberId: req.account.whatsappPhoneNumberId || '',
      },
    };
  }
}
