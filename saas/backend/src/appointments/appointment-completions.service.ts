import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../events/realtime.service';
import { serializeDates } from '../common/public-shapes';
import {
  APPT_STATUS,
  appointmentDurationMinutes,
  appointmentWindowUtc,
} from './appointment-status';

@Injectable()
export class AppointmentCompletionsService {
  private readonly logger = new Logger(AppointmentCompletionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Marca como concluídos os agendamentos cuja janela já encerrou. */
  async processDueCompletions() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    // Janela ampla de datas civis (fusos BR ±) para não perder bordas.
    const dates: string[] = [];
    for (let delta = -2; delta <= 1; delta++) {
      const d = new Date(now.getTime() + delta * 24 * 60 * 60 * 1000);
      dates.push(
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      );
      dates.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      );
    }
    const uniqueDates = [...new Set(dates)];

    const rows = await this.prisma.appointment.findMany({
      where: {
        status: APPT_STATUS.SCHEDULED,
        date: { in: uniqueDates },
      },
      include: {
        service: { select: { duration: true } },
        account: { select: { id: true, timezone: true } },
      },
    });

    let completed = 0;
    for (const row of rows) {
      const duration = appointmentDurationMinutes(row);
      const window = appointmentWindowUtc({
        date: row.date,
        time: row.time,
        durationMinutes: duration,
        timezone: row.account.timezone,
      });
      if (!window || now < window.endAt) continue;

      const updated = await this.prisma.appointment.updateMany({
        where: { id: row.id, status: APPT_STATUS.SCHEDULED },
        data: {
          status: APPT_STATUS.COMPLETED,
          completedAt: now,
        },
      });
      if (updated.count !== 1) continue;
      completed += 1;

      const fresh = await this.prisma.appointment.findUnique({
        where: { id: row.id },
      });
      if (fresh) {
        this.realtime.broadcast(row.accountId, 'appointment:updated', {
          appointment: serializeDates(fresh),
        });
      }
    }

    if (completed > 0) {
      this.logger.log(`Auto-concluiu ${completed} agendamento(s).`);
    }
    return { completed };
  }
}
