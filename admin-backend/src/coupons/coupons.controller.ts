import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_FREE_DAYS = [7, 30, 60] as const;

function normalizeCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function publicCoupon(row: {
  id: string;
  code: string;
  planId: string;
  freeDays: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  note: string;
  createdAt: Date;
  updatedAt: Date;
  plan?: { id: string; name: string; price: number } | null;
}) {
  return {
    id: row.id,
    code: row.code,
    planId: row.planId,
    planName: row.plan?.name ?? null,
    planPrice: row.plan?.price ?? null,
    freeDays: row.freeDays,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    remainingUses: Math.max(0, row.maxUses - row.usedCount),
    active: row.active,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Controller('api/coupons')
@UseGuards(AdminAuthGuard)
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const coupons = await this.prisma.promoCoupon.findMany({
      include: { plan: { select: { id: true, name: true, price: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { coupons: coupons.map(publicCoupon) };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const coupon = await this.prisma.promoCoupon.findUnique({
      where: { id },
      include: { plan: { select: { id: true, name: true, price: true } } },
    });
    if (!coupon) {
      throw new NotFoundException({ error: 'Cupom não encontrado.' });
    }
    return { coupon: publicCoupon(coupon) };
  }

  @Post()
  async create(
    @Body()
    body: {
      code?: string;
      planId?: string;
      freeDays?: number;
      maxUses?: number;
      note?: string;
      active?: boolean;
    },
  ) {
    const code = normalizeCode(body?.code);
    const planId = String(body?.planId || '').trim();
    const freeDays = Number(body?.freeDays);
    const maxUses = Number(body?.maxUses);
    const note = String(body?.note || '').trim();
    const active = body?.active !== false;

    if (!code || code.length < 3) {
      throw new BadRequestException({
        error: 'Código do cupom deve ter pelo menos 3 caracteres.',
      });
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      throw new BadRequestException({
        error: 'Código: use apenas letras, números, _ ou -.',
      });
    }
    if (!(ALLOWED_FREE_DAYS as readonly number[]).includes(freeDays)) {
      throw new BadRequestException({
        error: 'Dias grátis devem ser 7, 30 ou 60.',
      });
    }
    if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100_000) {
      throw new BadRequestException({
        error: 'Informe um número de usos válido (mínimo 1).',
      });
    }
    if (!planId) {
      throw new BadRequestException({ error: 'Selecione um plano.' });
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) {
      throw new BadRequestException({
        error: 'Plano inválido ou inativo.',
      });
    }

    const existing = await this.prisma.promoCoupon.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException({ error: 'Já existe um cupom com este código.' });
    }

    const coupon = await this.prisma.promoCoupon.create({
      data: {
        code,
        planId,
        freeDays,
        maxUses: Math.floor(maxUses),
        note,
        active,
      },
      include: { plan: { select: { id: true, name: true, price: true } } },
    });

    return { coupon: publicCoupon(coupon) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      maxUses?: number;
      note?: string;
      active?: boolean;
    },
  ) {
    const current = await this.prisma.promoCoupon.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException({ error: 'Cupom não encontrado.' });
    }

    const data: {
      maxUses?: number;
      note?: string;
      active?: boolean;
    } = {};

    if (body?.maxUses !== undefined) {
      const maxUses = Number(body.maxUses);
      if (!Number.isFinite(maxUses) || maxUses < current.usedCount) {
        throw new BadRequestException({
          error: `Máximo de usos deve ser ≥ usos já consumidos (${current.usedCount}).`,
        });
      }
      if (maxUses > 100_000) {
        throw new BadRequestException({ error: 'Máximo de usos inválido.' });
      }
      data.maxUses = Math.floor(maxUses);
    }
    if (body?.note !== undefined) {
      data.note = String(body.note || '').trim();
    }
    if (body?.active !== undefined) {
      data.active = Boolean(body.active);
    }

    const coupon = await this.prisma.promoCoupon.update({
      where: { id },
      data,
      include: { plan: { select: { id: true, name: true, price: true } } },
    });
    return { coupon: publicCoupon(coupon) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const current = await this.prisma.promoCoupon.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException({ error: 'Cupom não encontrado.' });
    }
    // Soft-delete: desativa (preserva histórico de redemptions)
    await this.prisma.promoCoupon.update({
      where: { id },
      data: { active: false },
    });
    return { ok: true };
  }
}
