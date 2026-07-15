import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
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

@Controller('api/employees')
@UseGuards(AuthGuard)
export class EmployeesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    const employees = await this.prisma.employee.findMany({
      where: { accountId: req.account.id },
      orderBy: { createdAt: 'asc' },
    });
    return { employees: employees.map((e) => serializeDates(e)) };
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; specialty?: string; phone?: string },
  ) {
    const name = String(body?.name || '').trim();
    const specialty = String(body?.specialty || '').trim();
    const phone = String(body?.phone || '').trim();
    if (!name) {
      throw new BadRequestException({
        error: 'Informe o nome do profissional.',
      });
    }

    const count = await this.prisma.employee.count({
      where: { accountId: req.account.id },
    });
    const employee = await this.prisma.employee.create({
      data: {
        accountId: req.account.id,
        name,
        specialty,
        phone,
        color: COLORS[count % COLORS.length],
      },
    });
    return { employee: serializeDates(employee) };
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
