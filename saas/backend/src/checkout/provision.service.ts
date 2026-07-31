import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutSession, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_OPENING_HOURS } from '../account/opening-hours';
import { PromoCouponsService } from '../promo-coupons/promo-coupons.service';
import { MailService } from '../mail/mail.service';
import { welcomeEmail } from '../mail/mail-templates';

@Injectable()
export class ProvisionService {
  private readonly logger = new Logger(ProvisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promos: PromoCouponsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async provisionAccount(
    session: CheckoutSession,
    options?: { couponCode?: string },
  ) {
    const existing = await this.prisma.account.findUnique({
      where: { email: session.email },
    });
    if (existing) {
      // Renovação / mudança de plano via Stripe (sessão já vinculada)
      if (session.accountId && session.accountId === existing.id) {
        const planRow = await this.prisma.plan.findFirst({
          where: { name: session.planName, active: true },
        });
        if (!planRow) {
          throw new BadRequestException({ error: 'Plano inválido.' });
        }
        const account = await this.promos.markAccountPaid(existing.id, {
          id: planRow.id,
          name: planRow.name,
          price: planRow.price,
        });
        await this.prisma.checkoutSession.update({
          where: { id: session.id },
          data: {
            status: 'approved',
            accountId: existing.id,
            passwordHash: null,
            delivered: false,
          },
        });
        return { account, alreadyExisted: true, renewed: true };
      }

      await this.prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'approved',
          accountId: existing.id,
          passwordHash: null,
          delivered: true,
        },
      });
      return { account: existing, alreadyExisted: true, renewed: false };
    }

    if (!session.passwordHash) {
      throw new BadRequestException({
        error: 'Sessão de checkout sem senha. Recomece a assinatura.',
      });
    }

    const planRow = await this.prisma.plan.findFirst({
      where: { name: session.planName, active: true },
    });

    const account = await this.prisma.account.create({
      data: {
        businessName: session.name,
        ownerName: session.name,
        email: session.email,
        phone: session.phone || '',
        passwordHash: session.passwordHash,
        plan: session.planName,
        planPrice: session.price,
        planId: planRow?.id ?? null,
        whatsappPhoneNumberId: '',
        openingHours: DEFAULT_OPENING_HOURS,
        status: 'active',
        billingSource: 'paid',
        promoExpiresAt: null,
      },
    });

    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: 'approved',
        accountId: account.id,
        passwordHash: null,
        delivered: false,
      },
    });

    let resultAccount = account;
    if (options?.couponCode) {
      const { account: withPromo } = await this.promos.redeemForAccount(
        account.id,
        options.couponCode,
      );
      resultAccount = withPromo;
    }

    await this.sendWelcomeEmail(resultAccount);

    return {
      account: resultAccount,
      alreadyExisted: false,
      renewed: false,
    };
  }

  private async sendWelcomeEmail(account: {
    email: string;
    ownerName: string;
    businessName: string;
    plan: string;
  }) {
    const publicUrl = (
      this.config.get<string>('publicUrl') || 'http://localhost:8081'
    ).replace(/\/+$/, '');
    const tpl = welcomeEmail({
      name: account.ownerName || account.businessName,
      businessName: account.businessName,
      email: account.email,
      loginUrl: `${publicUrl}/login`,
      planName: account.plan,
    });
    const ok = await this.mail.send({ to: account.email, ...tpl });
    if (!ok) {
      this.logger.warn(`Boas-vindas não enviadas para ${account.email}`);
    }
  }
}
