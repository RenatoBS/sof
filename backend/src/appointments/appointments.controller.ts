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
import { RealtimeService } from '../events/realtime.service';
import {
  type AppointmentPayload,
  validateAppointmentPayload,
} from './appointment-payload';

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

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const parsed = await validateAppointmentPayload(
      this.prisma,
      body,
      req.account,
    );
    if ('error' in parsed) {
      throw new BadRequestException({ error: parsed.error });
    }
    const data = parsed as AppointmentPayload;

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

    const parsed = await validateAppointmentPayload(
      this.prisma,
      { ...serializeDates(existing), ...body },
      req.account,
      { excludeAppointmentId: existing.id },
    );
    if ('error' in parsed) {
      throw new BadRequestException({ error: parsed.error });
    }
    const data = parsed as AppointmentPayload;

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
