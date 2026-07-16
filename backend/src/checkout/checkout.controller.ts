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
import { getPlan } from '../common/plans';
import { COOKIE_NAME, cookieOptions, signAccountToken } from '../common/token';
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
  ) {}

  @Post('create')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 15 * 60 * 1000 } })
  async create(
    @Body() body: { planName?: string; name?: string; email?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const planName = String(body?.planName || '').trim();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();

    const plan = getPlan(planName);
    if (!plan) throw new BadRequestException({ error: 'Plano inválido.' });
    if (!name) {
      throw new BadRequestException({ error: 'Informe o nome completo.' });
    }
    if (!isEmail(email)) {
      throw new BadRequestException({ error: 'Informe um e-mail válido.' });
    }

    const existing = await this.prisma.account.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        error:
          'Este e-mail já tem uma conta. Faça login em vez de assinar de novo.',
      });
    }

    const session = await this.prisma.checkoutSession.create({
      data: {
        planName: plan.name,
        price: plan.price,
        name,
        email,
        status: 'pending',
      },
    });

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
  async status(@Param('sessionId') sessionId: string) {
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

    if (session.delivered) {
      return { status: 'approved', email: session.email, delivered: true };
    }

    const tempPassword = session.tempPassword;
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: { delivered: true, tempPassword: null },
    });

    return {
      status: 'approved',
      email: session.email,
      tempPassword,
      delivered: false,
    };
  }
}
