import { Injectable } from '@nestjs/common';
import { CheckoutSession, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateTempPassword, hashPassword } from '../common/password';
import { DEFAULT_OPENING_HOURS } from '../account/opening-hours';

@Injectable()
export class ProvisionService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionAccount(session: CheckoutSession) {
    const existing = await this.prisma.account.findUnique({
      where: { email: session.email },
    });
    if (existing) {
      await this.prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'approved',
          accountId: existing.id,
          delivered: true,
        },
      });
      return { account: existing, tempPassword: null, alreadyExisted: true };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const account = await this.prisma.account.create({
      data: {
        businessName: session.name,
        ownerName: session.name,
        email: session.email,
        passwordHash,
        plan: session.planName,
        planPrice: session.price,
        whatsappPhoneNumberId: '',
        openingHours: DEFAULT_OPENING_HOURS as Prisma.InputJsonValue,
        status: 'active',
      },
    });

    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: 'approved',
        accountId: account.id,
        tempPassword,
        delivered: false,
      },
    });

    return { account, tempPassword, alreadyExisted: false };
  }
}
