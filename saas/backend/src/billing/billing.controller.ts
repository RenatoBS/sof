import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { publicAccount } from '../common/public-shapes';
import { COOKIE_NAME, cookieOptions, signAccountToken } from '../common/token';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PlansService } from '../plans/plans.service';
import { PromoCouponsService } from '../promo-coupons/promo-coupons.service';
import { StripeService } from '../checkout/stripe.service';

@Controller('api/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly plans: PlansService,
    private readonly promos: PromoCouponsService,
    private readonly stripe: StripeService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Conta autenticada aplica cupom (ex.: após pausa ou troca de plano). */
  @Post('redeem-coupon')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  async redeemCoupon(
    @Req() req: AuthedRequest,
    @Body() body: { couponCode?: string },
  ) {
    const { account } = await this.promos.redeemForAccount(
      req.account.id,
      body?.couponCode,
    );
    const entitlements = await this.entitlements.forAccount(account.id);
    return {
      account: { ...publicAccount(account), entitlements },
      promoExpiresAt: account.promoExpiresAt?.toISOString() ?? null,
    };
  }

  /**
   * Inicia Stripe Checkout (ou aprova em demo) para assinar / mudar plano
   * sem criar nova conta.
   */
  @Post('checkout')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 15 * 60 * 1000 } })
  async checkout(
    @Req() req: AuthedRequest,
    @Body() body: { planName?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const planName = String(body?.planName || '').trim();
    const plan = await this.plans.getByName(planName);
    if (!plan) throw new BadRequestException({ error: 'Plano inválido.' });

    const account = req.account;
    const session = await this.prisma.checkoutSession.create({
      data: {
        planName: plan.name,
        price: plan.price,
        name: account.ownerName || account.businessName,
        email: account.email,
        phone: account.phone || '',
        passwordHash: null,
        status: 'pending',
        accountId: account.id,
      },
    });

    if (this.stripe.isConfigured()) {
      if (!plan.stripePriceId) {
        throw new BadRequestException({
          error: 'Este plano ainda não tem preço Stripe configurado.',
        });
      }
      try {
        const checkout = await this.stripe.createCheckoutSession({
          sessionId: session.id,
          planName: plan.name,
          stripePriceId: plan.stripePriceId,
          payerEmail: account.email,
        });
        await this.prisma.checkoutSession.update({
          where: { id: session.id },
          data: { preferenceId: checkout.id },
        });
        return {
          mode: 'redirect',
          sessionId: session.id,
          initPoint: checkout.url,
        };
      } catch (err) {
        console.error(
          '[billing] Erro ao criar sessão Stripe:',
          (err as Error).message,
        );
        throw new BadRequestException({
          error:
            'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.',
        });
      }
    }

    if (!plan.id) {
      throw new BadRequestException({
        error: 'Plano sem catálogo no banco. Cadastre o plano no admin.',
      });
    }

    // Demo sem Stripe: ativa na hora
    const updated = await this.promos.markAccountPaid(account.id, {
      id: plan.id,
      name: plan.name,
      price: plan.price,
    });
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: 'approved',
        delivered: true,
        passwordHash: null,
      },
    });

    const jwtToken = signAccountToken(
      updated.id,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    res.cookie(
      COOKIE_NAME,
      jwtToken,
      cookieOptions(this.config.get<boolean>('isProd') === true),
    );
    const entitlements = await this.entitlements.forAccount(updated.id);
    return {
      mode: 'dev-approved',
      sessionId: session.id,
      token: jwtToken,
      account: { ...publicAccount(updated), entitlements },
    };
  }
}
