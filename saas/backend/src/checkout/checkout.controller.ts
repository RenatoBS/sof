import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNT_PASSWORD_MIN_LENGTH,
  hashPassword,
  isValidAccountPassword,
} from '../common/password';
import { isValidPhone, normalizePhone } from '../common/phone';
import { COOKIE_NAME, cookieOptions, signAccountToken } from '../common/token';
import { PlansService } from '../plans/plans.service';
import { PromoCouponsService } from '../promo-coupons/promo-coupons.service';
import { ProvisionService } from './provision.service';
import { StripeService } from './stripe.service';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Controller('api/checkout')
export class CheckoutController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly provision: ProvisionService,
    private readonly stripe: StripeService,
    private readonly plans: PlansService,
    private readonly promos: PromoCouponsService,
  ) {}

  @Post('create')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 15 * 60 * 1000 } })
  async create(
    @Body()
    body: {
      planName?: string;
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      couponCode?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const phone = normalizePhone(body?.phone);
    const password = body?.password;
    const couponCode = this.promos.normalizeCode(body?.couponCode);

    let planName = String(body?.planName || '').trim();
    let coupon = null as Awaited<
      ReturnType<PromoCouponsService['findUsableByCode']>
    > | null;

    if (couponCode) {
      coupon = await this.promos.findUsableByCode(couponCode);
      planName = coupon.plan.name;
    }

    const plan = await this.plans.getByName(planName);
    if (!plan) throw new BadRequestException({ error: 'Plano inválido.' });
    if (!name) {
      throw new BadRequestException({ error: 'Informe o nome completo.' });
    }
    if (!isEmail(email)) {
      throw new BadRequestException({ error: 'Informe um e-mail válido.' });
    }
    if (!isValidPhone(phone)) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDD (somente números).',
      });
    }
    if (!isValidAccountPassword(password)) {
      throw new BadRequestException({
        error: `A senha deve ter pelo menos ${ACCOUNT_PASSWORD_MIN_LENGTH} caracteres.`,
      });
    }

    const existing = await this.prisma.account.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        error:
          'Este e-mail já tem uma conta. Faça login em vez de assinar de novo.',
      });
    }

    const passwordHash = await hashPassword(password);

    const session = await this.prisma.checkoutSession.create({
      data: {
        planName: plan.name,
        price: plan.price,
        name,
        email,
        phone,
        passwordHash,
        status: 'pending',
      },
    });

    // Cupom: provisiona sem Stripe
    if (coupon) {
      const { account } = await this.provision.provisionAccount(session, {
        couponCode: coupon.code,
      });
      const jwtToken = signAccountToken(
        account.id,
        this.config.getOrThrow<string>('jwtSecret'),
      );
      res.cookie(
        COOKIE_NAME,
        jwtToken,
        cookieOptions(this.config.get<boolean>('isProd') === true),
      );
      return {
        mode: 'promo-approved',
        sessionId: session.id,
        token: jwtToken,
        promoExpiresAt: account.promoExpiresAt?.toISOString() ?? null,
        freeDays: coupon.freeDays,
        planName: coupon.plan.name,
      };
    }

    if (this.stripe.isConfigured()) {
      try {
        const checkout = await this.stripe.createCheckoutSession({
          sessionId: session.id,
          planName: plan.name,
          stripePriceId: plan.stripePriceId,
          payerEmail: email,
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
          '[checkout] Erro ao criar sessão Stripe:',
          (err as Error).message,
        );
        throw new BadRequestException({
          error:
            'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.',
        });
      }
    }

    const { account } = await this.provision.provisionAccount(session);
    const jwtToken = signAccountToken(
      account.id,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    res.cookie(
      COOKIE_NAME,
      jwtToken,
      cookieOptions(this.config.get<boolean>('isProd') === true),
    );
    return { mode: 'dev-approved', sessionId: session.id, token: jwtToken };
  }

  @Get('status/:sessionId')
  async status(
    @Param('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({
        error: 'Sessão de checkout não encontrada.',
      });
    }

    if (session.status !== 'approved') {
      return { status: session.status };
    }

    if (session.delivered || !session.accountId) {
      return { status: 'approved', email: session.email, delivered: true };
    }

    const jwtToken = signAccountToken(
      session.accountId,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: { delivered: true },
    });

    res.cookie(
      COOKIE_NAME,
      jwtToken,
      cookieOptions(this.config.get<boolean>('isProd') === true),
    );

    return {
      status: 'approved',
      email: session.email,
      token: jwtToken,
      delivered: false,
    };
  }
}
