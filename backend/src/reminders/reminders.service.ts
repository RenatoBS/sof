import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';
import { normalizePhone } from '../common/phone';
import {
  DEFAULT_ACCOUNT_TIMEZONE,
  addDaysToDateString,
  buildReminderMessage,
  dateStringInTimeZone,
  isReminderDue,
  zonedWallTimeToUtc,
} from './reminder-window';

const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

type CandidateRow = {
  id: string;
  accountId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  reminderClaimedAt: Date | null;
  reminderSentAt: Date | null;
  businessName: string;
  address: string;
  timezone: string;
  whatsappReminderMinutes: number;
  whatsappInstanceToken: string;
  serviceName: string | null;
  employeeName: string;
};

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappApiService,
  ) {}

  async processDueReminders(now = new Date()): Promise<{
    scanned: number;
    sent: number;
    skipped: number;
    failed: number;
  }> {
    if (this.running) {
      return { scanned: 0, sent: 0, skipped: 0, failed: 0 };
    }
    this.running = true;
    const stats = { scanned: 0, sent: 0, skipped: 0, failed: 0 };
    try {
      const candidates = await this.loadCandidates(now);
      stats.scanned = candidates.length;

      for (const row of candidates) {
        const result = await this.processOne(row, now);
        if (result === 'sent') stats.sent += 1;
        else if (result === 'failed') stats.failed += 1;
        else stats.skipped += 1;
      }

      if (stats.sent || stats.failed) {
        this.logger.log(
          `Lembretes: scanned=${stats.scanned} sent=${stats.sent} skipped=${stats.skipped} failed=${stats.failed}`,
        );
      }
      return stats;
    } finally {
      this.running = false;
    }
  }

  private async loadCandidates(now: Date): Promise<CandidateRow[]> {
    // Janela ampla em string YYYY-MM-DD cobrindo fusos BR (UTC±3 / Noronha).
    const utcToday = dateStringInTimeZone(now, 'UTC');
    const minDate = addDaysToDateString(utcToday, -1);
    const maxDate = addDaysToDateString(utcToday, 2);

    const rows = await this.prisma.$queryRaw<CandidateRow[]>(Prisma.sql`
      SELECT
        a.id,
        a."accountId",
        a."clientName",
        a."clientPhone",
        a.date,
        a.time,
        a."reminderClaimedAt",
        a."reminderSentAt",
        acc."businessName",
        acc.address,
        acc.timezone,
        acc."whatsappReminderMinutes",
        acc."whatsappInstanceToken",
        s.name AS "serviceName",
        e.name AS "employeeName"
      FROM "Appointment" a
      INNER JOIN "Account" acc ON acc.id = a."accountId"
      INNER JOIN "Employee" e ON e.id = a."employeeId"
      LEFT JOIN "Service" s ON s.id = a."serviceId"
      WHERE a.status = 'confirmed'
        AND a.kind = 'service'
        AND a."reminderSentAt" IS NULL
        AND a."clientPhone" <> ''
        AND a.date >= ${minDate}
        AND a.date <= ${maxDate}
        AND acc.status = 'active'
        AND acc."whatsappReminderMinutes" > 0
        AND acc."whatsappInstanceToken" <> ''
        AND acc."whatsappConnectedAt" IS NOT NULL
      ORDER BY a.date ASC, a.time ASC
    `);

    return rows;
  }

  private async processOne(
    row: CandidateRow,
    now: Date,
  ): Promise<'sent' | 'skipped' | 'failed'> {
    const lead = Number(row.whatsappReminderMinutes) || 0;
    if (lead <= 0) return 'skipped';

    const timeZone = row.timezone || DEFAULT_ACCOUNT_TIMEZONE;
    const startAt = zonedWallTimeToUtc(row.date, row.time, timeZone);
    if (!startAt) return 'skipped';
    if (!isReminderDue({ now, startAt, leadMinutes: lead })) {
      return 'skipped';
    }

    const phone = normalizePhone(row.clientPhone) || row.clientPhone.replace(/\D/g, '');
    if (!phone || phone.length < 10) return 'skipped';

    const claimed = await this.tryClaim(row.id, now);
    if (!claimed) return 'skipped';

    const message = buildReminderMessage({
      clientName: row.clientName,
      businessName: row.businessName,
      serviceName: row.serviceName || 'seu horário',
      employeeName: row.employeeName,
      date: row.date,
      time: row.time,
      address: row.address,
    });

    try {
      await this.whatsapp.sendText(
        phone,
        message,
        row.whatsappInstanceToken,
      );
      await this.prisma.appointment.update({
        where: { id: row.id },
        data: { reminderSentAt: now },
      });
      return 'sent';
    } catch (err) {
      this.logger.warn(
        `Falha ao enviar lembrete ${row.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      await this.releaseClaim(row.id);
      return 'failed';
    }
  }

  /** Claim atômico; retorna true se este processo ficou com o envio. */
  async tryClaim(appointmentId: string, now = new Date()): Promise<boolean> {
    const timeoutAt = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
    const updated = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Appointment"
      SET "reminderClaimedAt" = ${now}
      WHERE id = ${appointmentId}
        AND status = 'confirmed'
        AND "reminderSentAt" IS NULL
        AND (
          "reminderClaimedAt" IS NULL
          OR "reminderClaimedAt" < ${timeoutAt}
        )
    `);
    return Number(updated) === 1;
  }

  async releaseClaim(appointmentId: string): Promise<void> {
    await this.prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        reminderSentAt: null,
      },
      data: { reminderClaimedAt: null },
    });
  }
}
