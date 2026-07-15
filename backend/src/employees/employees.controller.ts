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

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

const employeeInclude = {
  services: {
    include: { service: true },
  },
} as const;

function shapeEmployee(
  employee: {
    id: string;
    accountId: string;
    name: string;
    color: string;
    createdAt: Date;
    services: { service: Record<string, unknown> & { createdAt: Date } }[];
  },
) {
  const { services: links, ...rest } = employee;
  return {
    ...serializeDates(rest),
    services: links.map((link) => serializeDates(link.service)),
  };
}

function parseServiceIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.map((id) => String(id || '').trim()).filter(Boolean),
    ),
  ];
}

@Controller('api/employees')
@UseGuards(AuthGuard)
export class EmployeesController {
  constructor(private readonly prisma: PrismaService) {}

  private async validatePayload(
    accountId: string,
    body: { name?: string; serviceIds?: unknown },
  ) {
    const name = String(body?.name || '').trim();
    const serviceIds = parseServiceIds(body?.serviceIds);

    if (!name) {
      throw new BadRequestException({
        error: 'Informe o nome do profissional.',
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

    return { name, serviceIds };
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
    @Body() body: { name?: string; serviceIds?: unknown },
  ) {
    const { name, serviceIds } = await this.validatePayload(
      req.account.id,
      body,
    );

    const count = await this.prisma.employee.count({
      where: { accountId: req.account.id },
    });
    const employee = await this.prisma.employee.create({
      data: {
        accountId: req.account.id,
        name,
        color: COLORS[count % COLORS.length],
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: employeeInclude,
    });
    return { employee: shapeEmployee(employee) };
  }

  @Put(':employeeId')
  async update(
    @Req() req: AuthedRequest,
    @Param('employeeId') employeeId: string,
    @Body() body: { name?: string; serviceIds?: unknown },
  ) {
    const existing = await this.prisma.employee.findFirst({
      where: { id: employeeId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Profissional não encontrado.' });
    }

    const { name, serviceIds } = await this.validatePayload(
      req.account.id,
      body,
    );

    const employee = await this.prisma.$transaction(async (tx) => {
      await tx.employeeService.deleteMany({
        where: { employeeId: existing.id },
      });
      return tx.employee.update({
        where: { id: existing.id },
        data: {
          name,
          services: {
            create: serviceIds.map((serviceId) => ({ serviceId })),
          },
        },
        include: employeeInclude,
      });
    });

    return { employee: shapeEmployee(employee) };
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
