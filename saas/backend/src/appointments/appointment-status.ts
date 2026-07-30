import {
  DEFAULT_ACCOUNT_TIMEZONE,
  zonedWallTimeToUtc,
} from '../reminders/reminder-window';

/** Valores persistidos em `Appointment.status`. */
export const APPT_STATUS = {
  /** Agendado — ocupa slot na agenda. */
  SCHEDULED: 'scheduled',
  /** Concluído — libera slot (inclusive se antecipado). */
  COMPLETED: 'completed',
  /** Cancelado — libera slot. */
  CANCELLED: 'cancelled',
} as const;

export type AppointmentStatus =
  (typeof APPT_STATUS)[keyof typeof APPT_STATUS];

/** Status que ainda ocupam horário na agenda. */
export const APPT_OCCUPIES_SLOT: AppointmentStatus[] = [APPT_STATUS.SCHEDULED];

/** Status visíveis no board da agenda (semana). */
export const APPT_AGENDA_VISIBLE: AppointmentStatus[] = [
  APPT_STATUS.SCHEDULED,
  APPT_STATUS.COMPLETED,
];

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return (
    value === APPT_STATUS.SCHEDULED ||
    value === APPT_STATUS.COMPLETED ||
    value === APPT_STATUS.CANCELLED
  );
}

export function appointmentDurationMinutes(appt: {
  durationMinutes?: number | null;
  service?: { duration?: number | null } | null;
}): number {
  return appt.durationMinutes ?? appt.service?.duration ?? 30;
}

export function appointmentWindowUtc(opts: {
  date: string;
  time: string;
  durationMinutes: number;
  timezone?: string | null;
}): { startAt: Date; endAt: Date } | null {
  const timeZone = opts.timezone || DEFAULT_ACCOUNT_TIMEZONE;
  const startAt = zonedWallTimeToUtc(opts.date, opts.time, timeZone);
  if (!startAt) return null;
  const endAt = new Date(startAt.getTime() + opts.durationMinutes * 60_000);
  return { startAt, endAt };
}

/**
 * Profissional só conclui dentro da janela [início, fim] do atendimento.
 * Conta (owner) pode concluir a qualquer momento enquanto estiver agendado.
 */
export function canCompleteAppointment(opts: {
  status: string;
  date: string;
  time: string;
  durationMinutes: number;
  timezone?: string | null;
  /** `employee` = janela obrigatória; `account` = só precisa estar scheduled. */
  actor: 'employee' | 'account';
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  if (opts.status !== APPT_STATUS.SCHEDULED) {
    return {
      ok: false,
      error:
        opts.status === APPT_STATUS.COMPLETED
          ? 'Este horário já está concluído.'
          : 'Só é possível concluir agendamentos ativos.',
    };
  }

  if (opts.actor === 'account') {
    return { ok: true };
  }

  const now = opts.now || new Date();
  const window = appointmentWindowUtc(opts);
  if (!window) {
    return { ok: false, error: 'Horário do agendamento inválido.' };
  }
  const { startAt, endAt } = window;
  if (now < startAt) {
    return {
      ok: false,
      error: 'Só é possível concluir depois que o horário começar.',
    };
  }
  if (now > endAt) {
    return {
      ok: false,
      error:
        'A janela deste atendimento já encerrou. O status será atualizado automaticamente.',
    };
  }
  return { ok: true };
}

export function appointmentStatusLabel(status: string): string {
  if (status === APPT_STATUS.SCHEDULED) return 'Agendado';
  if (status === APPT_STATUS.COMPLETED) return 'Concluído';
  if (status === APPT_STATUS.CANCELLED) return 'Cancelado';
  return status;
}
