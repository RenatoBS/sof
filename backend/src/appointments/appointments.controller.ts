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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { serializeDates } from '../common/public-shapes';
import { RealtimeService } from '../events/realtime.service';
import {
  appointmentCreateRows,
  type AppointmentPayload,
  validateAppointmentPayload,
} from './appointment-payload';
import {
  APPT_STATUS,
  appointmentDurationMinutes,
  canCompleteAppointment,
} from './appointment-status';

@Controller('api/appointments')
@UseGuards(AuthGuard)
export class AppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    const appointments = await this.prisma.appointment.findMany({
      where: { accountId: req.account.id },
      orderBy: { createdAt: 'asc' },
    });
    return { appointments: appointments.map((a) => serializeDates(a)) };
  }

  @Post(':appointmentId/complete')
  async complete(
    @Req() req: AuthedRequest,
    @Param('appointmentId') appointmentId: string,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, accountId: req.account.id },
      include: { service: { select: { duration: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Agendamento não encontrado.' });
    }

    const check = canCompleteAppointment({
      status: existing.status,
      date: existing.date,
      time: existing.time,
      durationMinutes: appointmentDurationMinutes(existing),
      timezone: req.account.timezone,
      actor: 'account',
    });
    if (!check.ok) {
      throw new BadRequestException({ error: check.error });
    }

    const appointment = await this.prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status: APPT_STATUS.COMPLETED,
        completedAt: new Date(),
      },
    });
    const shaped = serializeDates(appointment);
    this.realtime.broadcast(req.account.id, 'appointment:updated', {
      appointment: shaped,
    });
    return { appointment: shaped };
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = await validateAppointmentPayload(
      this.prisma,
      body,
      req.account,
    );
    if ('error' in parsed) {
      throw new BadRequestException({ error: parsed.error });
    }
    const data = parsed as AppointmentPayload;
    const rows = appointmentCreateRows(req.account.id, data);

    const created = await this.prisma.$transaction(
      rows.map((row) => this.prisma.appointment.create({ data: row })),
    );

    const shaped = created.map((a) => serializeDates(a));
    for (const appointment of shaped) {
      this.realtime.broadcast(req.account.id, 'appointment:created', {
        appointment,
      });
    }
    return { appointment: shaped[0], appointments: shaped };
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

    const merged = {
      ...serializeDates(existing),
      ...body,
      // Edição altera só esta ocorrência
      recurrence: undefined,
    };

    const parsed = await validateAppointmentPayload(
      this.prisma,
      merged,
      req.account,
      {
        excludeAppointmentId: existing.id,
        skipRecurrenceExpand: true,
      },
    );
    if ('error' in parsed) {
      throw new BadRequestException({ error: parsed.error });
    }
    const data = parsed as AppointmentPayload;

    const appointment = await this.prisma.appointment.update({
      where: { id: existing.id },
      data: {
        kind: data.kind,
        title: data.title,
        durationMinutes: data.durationMinutes,
        clientId: data.clientId,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        date: data.date,
        time: data.time,
        employeeId: data.employeeId,
        serviceId: data.serviceId,
        price: data.price,
      },
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
    @Query('scope') scope?: string,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Agendamento não encontrado.' });
    }

    const deleteSeries =
      scope === 'series' && Boolean(existing.recurrenceGroupId);

    if (deleteSeries) {
      const series = await this.prisma.appointment.findMany({
        where: {
          accountId: req.account.id,
          recurrenceGroupId: existing.recurrenceGroupId!,
        },
        select: { id: true },
      });
      await this.prisma.appointment.deleteMany({
        where: {
          accountId: req.account.id,
          recurrenceGroupId: existing.recurrenceGroupId!,
        },
      });
      for (const row of series) {
        this.realtime.broadcast(req.account.id, 'appointment:deleted', {
          appointmentId: row.id,
        });
      }
      return { ok: true, deletedCount: series.length };
    }

    await this.prisma.appointment.delete({ where: { id: existing.id } });
    this.realtime.broadcast(req.account.id, 'appointment:deleted', {
      appointmentId: existing.id,
    });
    return { ok: true, deletedCount: 1 };
  }
}
