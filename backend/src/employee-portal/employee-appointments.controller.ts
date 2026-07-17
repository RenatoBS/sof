import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeDates } from '../common/public-shapes';
import { isValidPhone, normalizePhone } from '../common/phone';
import { RealtimeService } from '../events/realtime.service';
import {
  appointmentCreateRows,
  type AppointmentPayload,
  validateAppointmentPayload,
} from '../appointments/appointment-payload';
import {
  EmployeeAuthGuard,
  type EmployeeAuthedRequest,
} from './employee-auth.guard';

@Controller('api/employee')
@UseGuards(EmployeeAuthGuard)
export class EmployeeAppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get('appointments')
  async list(@Req() req: EmployeeAuthedRequest) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        accountId: req.account.id,
        employeeId: req.employee.id,
        status: 'confirmed',
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    return { appointments: appointments.map((a) => serializeDates(a)) };
  }

  @Post('appointments')
  async create(
    @Req() req: EmployeeAuthedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = await validateAppointmentPayload(
      this.prisma,
      body,
      req.account,
      { forceEmployeeId: req.employee.id },
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

  @Post('appointments/:appointmentId/cancel')
  async cancel(
    @Req() req: EmployeeAuthedRequest,
    @Param('appointmentId') appointmentId: string,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        accountId: req.account.id,
        employeeId: req.employee.id,
        status: 'confirmed',
      },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Agendamento não encontrado.' });
    }

    const appointment = await this.prisma.appointment.update({
      where: { id: existing.id },
      data: { status: 'cancelled' },
    });
    const shaped = serializeDates(appointment);
    this.realtime.broadcast(req.account.id, 'appointment:updated', {
      appointment: shaped,
    });
    return { appointment: shaped };
  }

  @Get('clients')
  async listClients(@Req() req: EmployeeAuthedRequest) {
    const clients = await this.prisma.client.findMany({
      where: { accountId: req.account.id },
      orderBy: { name: 'asc' },
    });
    return { clients: clients.map((c) => serializeDates(c)) };
  }

  @Post('clients')
  async createClient(
    @Req() req: EmployeeAuthedRequest,
    @Body() body: { name?: string; phone?: string },
  ) {
    const name = String(body?.name || '').trim();
    const phone = normalizePhone(body?.phone);

    if (!name) {
      throw new BadRequestException({ error: 'Informe o nome do cliente.' });
    }
    if (!isValidPhone(phone)) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDD (somente números).',
      });
    }

    const taken = await this.prisma.client.findUnique({
      where: {
        accountId_phone: { accountId: req.account.id, phone },
      },
    });
    if (taken) {
      throw new BadRequestException({
        error: 'Já existe um cliente com este telefone.',
      });
    }

    const client = await this.prisma.client.create({
      data: {
        accountId: req.account.id,
        name,
        phone,
      },
    });
    return { client: serializeDates(client) };
  }

  @Get('services')
  async listServices(@Req() req: EmployeeAuthedRequest) {
    const links = await this.prisma.employeeService.findMany({
      where: { employeeId: req.employee.id },
      include: { service: true },
      orderBy: { service: { createdAt: 'asc' } },
    });
    return {
      services: links.map((link) => serializeDates(link.service)),
    };
  }
}
