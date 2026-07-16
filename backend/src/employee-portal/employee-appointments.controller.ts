import {
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
import { RealtimeService } from '../events/realtime.service';
import {
  EmployeeAuthGuard,
  type EmployeeAuthedRequest,
} from './employee-auth.guard';

@Controller('api/employee/appointments')
@UseGuards(EmployeeAuthGuard)
export class EmployeeAppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get()
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

  @Post(':appointmentId/cancel')
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
}
