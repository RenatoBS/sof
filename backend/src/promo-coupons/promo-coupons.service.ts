import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Account, Plan, Prisma, PromoCoupon } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const ALLOWED_FREE_DAYS = [7, 30, 60] as const;
export type FreeDays = (typeof ALLOWED_FREE_DAYS)[number];

export type CouponWithPlan = PromoCoupon & { plan: Plan };

@Injectable()
export class PromoCouponsService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeCode(raw: unknown): string {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  isValidFreeDays(value: number): value is FreeDays {
    return (ALLOWED_FREE_DAYS as readonly number[]).includes(value);
  }

  async findUsableByCode(codeRaw: unknown): Promise<CouponWithPlan> {
    const code = this.normalizeCode(codeRaw);
    if (!code) {
      throw new BadRequestException({ error: 'Informe o código do cupom.' });
    }

    const coupon = await this.prisma.promoCoupon.findUnique({
      where: { code },
      include: { plan: true },
    });
    if (!coupon || !coupon.active) {
      throw new NotFoundException({ error: 'Cupom inválido ou inativo.' });
    }
    if (!coupon.plan.active) {
      throw new BadRequestException({
        error: 'O plano deste cupom não está mais disponível.',
      });
    }
    if (coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException({
        error: 'Este cupom já atingiu o limite de usos.',
      });
    }
    return coupon;
  }

  expiresAtFromNow(freeDays: number, from = new Date()): Date {
    const expires = new Date(from);
    expires.setUTCDate(expires.getUTCDate() + freeDays);
    return expires;
  }

  /**
   * Reserva 1 uso do cupom e aplica plano + período grátis na conta.
   * Usa transação para evitar oversell sob concorrência.
   */
  async redeemForAccount(
    accountId: string,
    codeRaw: unknown,
  ): Promise<{ account: Account; coupon: CouponWithPlan; expiresAt: Date }> {
    const code = this.normalizeCode(codeRaw);
    if (!code) {
      throw new BadRequestException({ error: 'Informe o código do cupom.' });
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const coupon = await tx.promoCoupon.findUnique({
          where: { code },
          include: { plan: true },
        });
        if (!coupon || !coupon.active) {
          throw new NotFoundException({ error: 'Cupom inválido ou inativo.' });
        }
        if (!coupon.plan.active) {
          throw new BadRequestException({
            error: 'O plano deste cupom não está mais disponível.',
          });
        }
        if (coupon.usedCount >= coupon.maxUses) {
          throw new BadRequestException({
            error: 'Este cupom já atingiu o limite de usos.',
          });
        }

        const existing = await tx.promoCouponRedemption.findUnique({
          where: {
            couponId_accountId: {
              couponId: coupon.id,
              accountId,
            },
          },
        });
        if (existing) {
          throw new ConflictException({
            error: 'Esta conta já utilizou este cupom.',
          });
        }

        const updated = await tx.promoCoupon.updateMany({
          where: {
            id: coupon.id,
            usedCount: { lt: coupon.maxUses },
            active: true,
          },
          data: { usedCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new BadRequestException({
            error: 'Este cupom já atingiu o limite de usos.',
          });
        }

        const expiresAt = this.expiresAtFromNow(coupon.freeDays);
        await tx.promoCouponRedemption.create({
          data: {
            couponId: coupon.id,
            accountId,
            expiresAt,
          },
        });

        const account = await tx.account.update({
          where: { id: accountId },
          data: {
            plan: coupon.plan.name,
            planPrice: coupon.plan.price,
            planId: coupon.plan.id,
            status: 'active',
            billingSource: 'promo',
            promoExpiresAt: expiresAt,
          },
        });

        return { account, coupon, expiresAt };
      });
      return result;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'Esta conta já utilizou este cupom.',
        });
      }
      throw err;
    }
  }

  /** Marca contas com promo vencida como `paused` (lazy + job). */
  async pauseIfPromoExpired(account: Account): Promise<Account> {
    if (
      account.status !== 'active' ||
      account.billingSource !== 'promo' ||
      !account.promoExpiresAt
    ) {
      return account;
    }
    if (account.promoExpiresAt.getTime() > Date.now()) {
      return account;
    }
    return this.prisma.account.update({
      where: { id: account.id },
      data: { status: 'paused' },
    });
  }

  async pauseExpiredPromos(): Promise<number> {
    const result = await this.prisma.account.updateMany({
      where: {
        status: 'active',
        billingSource: 'promo',
        promoExpiresAt: { lte: new Date() },
      },
      data: { status: 'paused' },
    });
    return result.count;
  }

  /** Após pagamento Stripe: conta paga, limpa promo. */
  async markAccountPaid(
    accountId: string,
    plan: { name: string; price: number; id: string },
  ): Promise<Account> {
    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        plan: plan.name,
        planPrice: plan.price,
        planId: plan.id,
        status: 'active',
        billingSource: 'paid',
        promoExpiresAt: null,
      },
    });
  }
}
