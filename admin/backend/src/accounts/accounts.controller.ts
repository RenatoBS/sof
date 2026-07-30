import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateTempPassword,
  hashPassword,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from '../common/password';
import { isValidPhone, normalizePhone } from '../common/phone';
import { publicAccount } from '../common/public-shapes';
import { AdminAuthGuard } from '../auth/admin-auth.guard';

const DEFAULT_OPENING_HOURS = [
  { open: false, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
];

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Controller('api/accounts')
@UseGuards(AdminAuthGuard)
export class AccountsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('planId') planIdRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      Math.max(parseInt(limitRaw || '50', 10) || 50, 1),
      100,
    );
    const offset = Math.max(parseInt(offsetRaw || '0', 10) || 0, 0);
    const where: Prisma.AccountWhereInput = {};
    if (status === 'active' || status === 'suspended' || status === 'paused') {
      where.status = status;
    }
    const planId = String(planIdRaw || '').trim();
    if (planId) {
      where.planId = planId;
    }
    const query = String(q || '').trim();
    if (query) {
      where.OR = [
        { email: { contains: query, mode: 'insensitive' } },
        { businessName: { contains: query, mode: 'insensitive' } },
        { ownerName: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      accounts: rows.map(publicAccount),
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException({ error: 'Conta não encontrada.' });
    }
    const [employees, appointments] = await Promise.all([
      this.prisma.employee.count({ where: { accountId: id } }),
      this.prisma.appointment.count({ where: { accountId: id } }),
    ]);
    return {
      account: publicAccount(account),
      stats: { employees, appointments },
    };
  }

  @Post()
  async create(
    @Body()
    body: {
      businessName?: string;
      ownerName?: string;
      email?: string;
      phone?: string;
      password?: string;
      plan?: string;
      planPrice?: number;
      status?: string;
    },
  ) {
    const businessName = String(body?.businessName || '').trim();
    const ownerName = String(body?.ownerName || '').trim();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const phone = normalizePhone(body?.phone);
    const plan = String(body?.plan || '').trim();
    const planPrice = Number(body?.planPrice);
    const status =
      body?.status === 'suspended' ? 'suspended' : 'active';

    if (!businessName || !ownerName) {
      throw new BadRequestException({
        error: 'Informe nome do negócio e do responsável.',
      });
    }
    if (!isEmail(email)) {
      throw new BadRequestException({ error: 'Informe um e-mail válido.' });
    }
    if (!isValidPhone(phone)) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDD (somente números).',
      });
    }
    if (!plan || !Number.isFinite(planPrice) || planPrice < 0) {
      throw new BadRequestException({ error: 'Informe plano e preço válidos.' });
    }

    let password = String(body?.password || '');
    let generatedPassword: string | undefined;
    if (!password) {
      generatedPassword = generateTempPassword();
      password = generatedPassword;
    } else if (!isValidPassword(password)) {
      throw new BadRequestException({
        error: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      });
    }

    const existing = await this.prisma.account.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException({ error: 'Este e-mail já tem uma conta.' });
    }

    const passwordHash = await hashPassword(password);
    const planRow = await this.prisma.plan.findFirst({
      where: { name: plan, active: true },
    });
    const account = await this.prisma.account.create({
      data: {
        businessName,
        ownerName,
        email,
        phone,
        passwordHash,
        plan,
        planPrice,
        planId: planRow?.id ?? null,
        status,
        openingHours: DEFAULT_OPENING_HOURS,
      },
    });

    return {
      account: publicAccount(account),
      ...(generatedPassword ? { temporaryPassword: generatedPassword } : {}),
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      businessName?: string;
      ownerName?: string;
      email?: string;
      phone?: string;
      plan?: string;
      planId?: string | null;
      planPrice?: number;
      status?: string;
    },
  ) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException({ error: 'Conta não encontrada.' });
    }

    const data: Prisma.AccountUpdateInput = {};
    if (body.businessName !== undefined) {
      const v = String(body.businessName).trim();
      if (!v) throw new BadRequestException({ error: 'Nome do negócio inválido.' });
      data.businessName = v;
    }
    if (body.ownerName !== undefined) {
      const v = String(body.ownerName).trim();
      if (!v) throw new BadRequestException({ error: 'Nome do responsável inválido.' });
      data.ownerName = v;
    }
    if (body.phone !== undefined) {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) {
        throw new BadRequestException({
          error: 'Informe um telefone válido com DDD (somente números).',
        });
      }
      data.phone = phone;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!isEmail(email)) {
        throw new BadRequestException({ error: 'E-mail inválido.' });
      }
      if (email !== account.email) {
        const clash = await this.prisma.account.findUnique({ where: { email } });
        if (clash) {
          throw new BadRequestException({ error: 'E-mail já em uso.' });
        }
      }
      data.email = email;
    }
    if (body.plan !== undefined) {
      const plan = String(body.plan).trim();
      if (!plan) throw new BadRequestException({ error: 'Plano inválido.' });
      data.plan = plan;
      const planRow = await this.prisma.plan.findFirst({
        where: { name: plan, active: true },
      });
      data.planRef = planRow
        ? { connect: { id: planRow.id } }
        : { disconnect: true };
    }
    if (body.planId !== undefined) {
      const planId = body.planId ? String(body.planId).trim() : '';
      if (planId) {
        const planRow = await this.prisma.plan.findUnique({
          where: { id: planId },
        });
        if (!planRow) {
          throw new BadRequestException({ error: 'Plano não encontrado.' });
        }
        data.planRef = { connect: { id: planRow.id } };
        data.plan = planRow.name;
        if (body.planPrice === undefined) {
          data.planPrice = planRow.price;
        }
      } else {
        data.planRef = { disconnect: true };
      }
    }
    if (body.planPrice !== undefined) {
      const planPrice = Number(body.planPrice);
      if (!Number.isFinite(planPrice) || planPrice < 0) {
        throw new BadRequestException({ error: 'Preço inválido.' });
      }
      data.planPrice = planPrice;
    }
    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'suspended') {
        throw new BadRequestException({ error: 'Status inválido.' });
      }
      data.status = body.status;
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data,
    });
    return { account: publicAccount(updated) };
  }

  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException({ error: 'Conta não encontrada.' });
    }
    const temporaryPassword = generateTempPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await this.prisma.account.update({
      where: { id },
      data: { passwordHash },
    });
    return { ok: true, temporaryPassword };
  }
}
