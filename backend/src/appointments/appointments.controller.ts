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
import { Account } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { serializeDates } from '../common/public-shapes';
import { RealtimeService } from '../events/realtime.service';
import {
  hasScheduleConflict,
  listBusySlots,
} from './schedule-conflict';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

@Controller('api/appointments')
@UseGuards(AuthGuard)
export class AppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private async validatePayload(
    body: Record<string, unknown>,
    account: Account,
    excludeAppointmentId?: string,
  ) {
    const clientName = String(body?.clientName || '').trim();
    const date = String(body?.date || '');
    const time = String(body?.time || '');
    const employeeId = String(body?.employeeId || '');
    const serviceId = String(body?.serviceId || '');

    if (!clientName) return { error: 'Informe o nome do cliente.' };
    if (!DATE_RE.test(date)) return { error: 'Data inválida.' };
    if (!TIME_RE.test(time)) return { error: 'Horário inválido.' };

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, accountId: account.id },
    });
    if (!employee) return { error: 'Profissional inválido.' };

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, accountId: account.id },
    });
    if (!service) return { error: 'Serviço inválido.' };

    const link = await this.prisma.employeeService.findUnique({
      where: {
        employeeId_serviceId: { employeeId, serviceId },
      },
    });
    if (!link) {
      return { error: 'Este profissional não realiza esse serviço.' };
    }

    const busy = await listBusySlots(this.prisma, {
      accountId: account.id,
      employeeId,
      date,
      excludeAppointmentId,
    });
    if (hasScheduleConflict(busy, time, service.duration)) {
      return {
        error:
          'Este profissional já tem um agendamento nesse horário. Escolha outro horário.',
      };
    }

    return {
      clientName,
      clientPhone: String(body?.clientPhone || '').trim(),
      date,
      time,
      employeeId,
      serviceId,
      price: service.price,
    };
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    const appointments = await this.prisma.appointment.findMany({
      where: { accountId: req.account.id },
      orderBy: { createdAt: 'asc' },
    });
    return { appointments: appointments.map((a) => serializeDates(a)) };
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const parsed = await this.validatePayload(body, req.account);
    if ('error' in parsed && parsed.error) {
      throw new BadRequestException({ error: parsed.error });
    }
    const data = parsed as {
      clientName: string;
      clientPhone: string;
      date: string;
      time: string;
      employeeId: string;
      serviceId: string;
      price: number;
    };

    const appointment = await this.prisma.appointment.create({
      data: {
        accountId: req.account.id,
        status: 'confirmed',
        source: 'manual',
        ...data,
      },
    });
    const shaped = serializeDates(appointment);
    this.realtime.broadcast(req.account.id, 'appointment:created', {
      appointment: shaped,
    });
    return { appointment: shaped };
  }

  @Put(':appointmentId')
  async update(
    @Req() req: AuthedRequest,
    @Param('appointmentId') appointmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Agendamento não encontrado.' });
    }

    const parsed = await this.validatePayload(
      { ...serializeDates(existing), ...body },
      req.account,
      existing.id,
    );
    if ('error' in parsed && parsed.error) {
      throw new BadRequestException({ error: parsed.error });
    }
    const data = parsed as {
      clientName: string;
      clientPhone: string;
      date: string;
      time: string;
      employeeId: string;
      serviceId: string;
      price: number;
    };

    const appointment = await this.prisma.appointment.update({
      where: { id: existing.id },
      data,
    });
    const shaped = serializeDates(appointment);
    this.realtime.broadcast(req.account.id, 'appointment:updated', {
      appointment: shaped,
    });
    return { appointment: shaped };
  }

  @Delete(':appointmentId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('appointmentId') appointmentId: string,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Agendamento não encontrado.' });
    }
    await this.prisma.appointment.delete({ where: { id: existing.id } });
    this.realtime.broadcast(req.account.id, 'appointment:deleted', {
      appointmentId: existing.id,
    });
    return { ok: true };
  }
}
