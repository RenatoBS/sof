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
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { serializeDates } from '../common/public-shapes';
import { isValidPhone, normalizePhone } from '../common/phone';
import { EmployeePasswordTokenService } from '../employee-portal/employee-password-token.service';
import { EmployeePasswordResetService } from '../employee-portal/employee-password-reset.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

/** Defaults when creating without an explicit color (matches product presets). */
const DEFAULT_COLORS = [
  '#3d4743',
  '#c19a6b',
  '#5b7a6e',
  '#8f6e45',
  '#6e7873',
  '#a67c52',
] as const;

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHexColor(raw: string): string {
  const color = raw.trim().toLowerCase();
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
}

/** Any CSS hex (#RGB / #RRGGBB). Empty falls back to default. */
function parseColor(raw: unknown, fallback: string): string {
  const color = String(raw || '')
    .trim()
    .toLowerCase();
  if (!color) return normalizeHexColor(fallback);
  if (!HEX_COLOR_RE.test(color)) {
    throw new BadRequestException({
      error: 'Cor inválida. Use um código hexadecimal (#RGB ou #RRGGBB).',
    });
  }
  return normalizeHexColor(color);
}

const employeeInclude = {
  services: {
    include: { service: true },
  },
} as const;

function shapeEmployee(employee: {
  id: string;
  accountId: string;
  name: string;
  email: string | null;
  phone: string;
  mustChangePassword: boolean;
  canHandleHandoffs: boolean;
  color: string;
  createdAt: Date;
  services: { service: Record<string, unknown> & { createdAt: Date } }[];
}) {
  const { services: links, ...rest } = employee;
  return {
    id: rest.id,
    accountId: rest.accountId,
    name: rest.name,
    email: rest.email || '',
    phone: rest.phone || '',
    mustChangePassword: rest.mustChangePassword,
    canHandleHandoffs: Boolean(rest.canHandleHandoffs),
    color: rest.color,
    createdAt: rest.createdAt.toISOString(),
    services: links.map((link) => serializeDates(link.service)),
  };
}

function parseServiceIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

@Controller('api/employees')
@UseGuards(AuthGuard)
export class EmployeesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordTokens: EmployeePasswordTokenService,
    private readonly passwordReset: EmployeePasswordResetService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async assertEmailAvailable(
    email: string,
    excludeEmployeeId?: string,
  ) {
    const accountTaken = await this.prisma.account.findUnique({
      where: { email },
    });
    if (accountTaken) {
      throw new BadRequestException({
        error: 'Este e-mail já está em uso por uma conta Sof.',
      });
    }

    const employeeTaken = await this.prisma.employee.findUnique({
      where: { email },
    });
    if (employeeTaken && employeeTaken.id !== excludeEmployeeId) {
      throw new BadRequestException({
        error: 'Este e-mail já está em uso por outro profissional.',
      });
    }
  }

  private async validatePayload(
    accountId: string,
    body: {
      name?: string;
      email?: string;
      phone?: string;
      serviceIds?: unknown;
    },
    options: { requireEmail: boolean },
  ) {
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const phone = normalizePhone(body?.phone);
    const serviceIds = parseServiceIds(body?.serviceIds);

    if (!name) {
      throw new BadRequestException({
        error: 'Informe o nome do profissional.',
      });
    }
    if (options.requireEmail || email) {
      if (!EMAIL_RE.test(email)) {
        throw new BadRequestException({
          error: 'Informe um e-mail válido para o acesso do profissional.',
        });
      }
    }
    if (!isValidPhone(phone)) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDD (somente números).',
      });
    }
    if (serviceIds.length === 0) {
      throw new BadRequestException({
        error: 'Selecione ao menos um serviço.',
      });
    }

    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, accountId },
    });
    if (services.length !== serviceIds.length) {
      throw new BadRequestException({
        error: 'Um ou mais serviços são inválidos.',
      });
    }

    return { name, email: email || null, phone, serviceIds };
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    const employees = await this.prisma.employee.findMany({
      where: { accountId: req.account.id },
      include: employeeInclude,
      orderBy: { createdAt: 'asc' },
    });
    return { employees: employees.map((e) => shapeEmployee(e)) };
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      name?: string;
      email?: string;
      phone?: string;
      serviceIds?: unknown;
      color?: string;
      canHandleHandoffs?: boolean;
    },
  ) {
    const { name, email, phone, serviceIds } = await this.validatePayload(
      req.account.id,
      body,
      { requireEmail: true },
    );
    if (!email) {
      throw new BadRequestException({
        error: 'Informe um e-mail válido para o acesso do profissional.',
      });
    }

    await this.assertEmailAvailable(email);

    const count = await this.prisma.employee.count({
      where: { accountId: req.account.id },
    });
    await this.entitlements.assertLimit(req.account.id, 'maxEmployees', count);
    const color = parseColor(
      body?.color,
      DEFAULT_COLORS[count % DEFAULT_COLORS.length],
    );
    const canHandleHandoffs = body?.canHandleHandoffs === true;
    const employee = await this.prisma.employee.create({
      data: {
        accountId: req.account.id,
        name,
        email,
        phone,
        passwordHash: null,
        mustChangePassword: true,
        color,
        canHandleHandoffs,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: employeeInclude,
    });

    const { resetLink, expiresAt } = await this.passwordTokens.issueResetLink(
      employee.id,
    );

    return {
      employee: shapeEmployee(employee),
      resetLink,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @Put(':employeeId')
  async update(
    @Req() req: AuthedRequest,
    @Param('employeeId') employeeId: string,
    @Body()
    body: {
      name?: string;
      email?: string;
      phone?: string;
      serviceIds?: unknown;
      color?: string;
      canHandleHandoffs?: boolean;
      resetPassword?: boolean;
    },
  ) {
    const existing = await this.prisma.employee.findFirst({
      where: { id: employeeId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Profissional não encontrado.' });
    }

    const { name, email, phone, serviceIds } = await this.validatePayload(
      req.account.id,
      body,
      { requireEmail: true },
    );
    if (!email) {
      throw new BadRequestException({
        error: 'Informe um e-mail válido para o acesso do profissional.',
      });
    }

    await this.assertEmailAvailable(email, existing.id);

    const color = parseColor(body?.color, existing.color);
    const resetPassword = body?.resetPassword === true;
    const needsInvite = resetPassword || !existing.passwordHash;
    const canHandleHandoffs =
      typeof body?.canHandleHandoffs === 'boolean'
        ? body.canHandleHandoffs
        : existing.canHandleHandoffs;

    const employee = await this.prisma.$transaction(async (tx) => {
      await tx.employeeService.deleteMany({
        where: { employeeId: existing.id },
      });
      return tx.employee.update({
        where: { id: existing.id },
        data: {
          name,
          email,
          phone,
          color,
          canHandleHandoffs,
          ...(needsInvite
            ? { passwordHash: null, mustChangePassword: true }
            : {}),
          services: {
            create: serviceIds.map((serviceId) => ({ serviceId })),
          },
        },
        include: employeeInclude,
      });
    });

    if (!needsInvite) {
      return { employee: shapeEmployee(employee) };
    }

    const { resetLink, expiresAt } = await this.passwordTokens.issueResetLink(
      employee.id,
    );

    return {
      employee: shapeEmployee(employee),
      resetLink,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @Post(':employeeId/send-password-link')
  async sendPasswordLink(
    @Req() req: AuthedRequest,
    @Param('employeeId') employeeId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, accountId: req.account.id },
    });
    if (!employee) {
      throw new NotFoundException({ error: 'Profissional não encontrado.' });
    }

    const { resetLink, expiresAt } =
      await this.passwordReset.issueAndSendWhatsapp({
        employee,
        account: req.account,
        source: 'account',
      });

    return {
      ok: true,
      sent: true,
      resetLink,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @Delete(':employeeId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('employeeId') employeeId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, accountId: req.account.id },
    });
    if (!employee) {
      throw new NotFoundException({ error: 'Profissional não encontrado.' });
    }
    await this.prisma.employee.delete({ where: { id: employee.id } });
    return { ok: true };
  }
}
