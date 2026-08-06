import { timeToMinutes } from '../appointments/schedule-conflict';

export type DaySchedule = {
  open: boolean;
  start: string;
  end: string;
};

/** Índice 0 = domingo … 6 = sábado (igual a `Date#getDay`). */
export type OpeningHours = DaySchedule[];

const TIME_RE = /^\d{2}:\d{2}$/;

const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export const DEFAULT_OPENING_HOURS: OpeningHours = [
  { open: false, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
];

function isValidTime(value: string): boolean {
  if (!TIME_RE.test(value)) return false;
  const [h, m] = value.split(':').map((n) => parseInt(n, 10));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function normalizeOpeningHours(raw: unknown): OpeningHours {
  if (!Array.isArray(raw) || raw.length !== 7) {
    return DEFAULT_OPENING_HOURS.map((d) => ({ ...d }));
  }

  return raw.map((item, idx) => {
    const fallback = DEFAULT_OPENING_HOURS[idx];
    if (!item || typeof item !== 'object') return { ...fallback };
    const row = item as Record<string, unknown>;
    const open = Boolean(row.open);
    const start =
      typeof row.start === 'string' && isValidTime(row.start)
        ? row.start
        : fallback.start;
    const end =
      typeof row.end === 'string' && isValidTime(row.end)
        ? row.end
        : fallback.end;
    return { open, start, end };
  });
}

/** Valida payload de edição. Retorna mensagem de erro ou hours normalizados. */
export function parseOpeningHoursInput(
  raw: unknown,
): { error: string } | { hours: OpeningHours } {
  if (!Array.isArray(raw) || raw.length !== 7) {
    return { error: 'Informe os 7 dias da semana (domingo a sábado).' };
  }

  const hours: OpeningHours = [];
  let anyOpen = false;

  for (let i = 0; i < 7; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') {
      return { error: `Dia inválido: ${WEEKDAY_LABELS[i]}.` };
    }
    const row = item as Record<string, unknown>;
    const open = Boolean(row.open);
    const start = String(row.start || '');
    const end = String(row.end || '');

    if (!isValidTime(start) || !isValidTime(end)) {
      return {
        error: `${WEEKDAY_LABELS[i]}: horário inválido (use HH:MM).`,
      };
    }
    if (open && timeToMinutes(start) >= timeToMinutes(end)) {
      return {
        error: `${WEEKDAY_LABELS[i]}: o horário de abertura deve ser antes do fechamento.`,
      };
    }
    if (open) anyOpen = true;
    hours.push({ open, start, end });
  }

  if (!anyOpen) {
    return { error: 'Deixe pelo menos um dia aberto.' };
  }

  return { hours };
}

export function weekdayFromDate(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

export function getDaySchedule(hours: OpeningHours, date: string): DaySchedule {
  const normalized = normalizeOpeningHours(hours);
  return normalized[weekdayFromDate(date)];
}

export type OpeningCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'closed' | 'outside';
      day: DaySchedule;
      label: string;
    };

/** Verifica se o serviço cabe inteiro dentro do expediente do dia. */
export function checkWithinOpeningHours(
  hours: unknown,
  date: string,
  startTime: string,
  durationMinutes: number,
): OpeningCheckResult {
  const normalized = normalizeOpeningHours(hours);
  const weekday = weekdayFromDate(date);
  const day = normalized[weekday];
  const label = WEEKDAY_LABELS[weekday];

  if (!day.open) {
    return { ok: false, reason: 'closed', day, label };
  }

  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  const openAt = timeToMinutes(day.start);
  const closeAt = timeToMinutes(day.end);

  if (start < openAt || end > closeAt) {
    return { ok: false, reason: 'outside', day, label };
  }

  return { ok: true };
}

export function formatOpeningHoursSummary(hours: unknown): string {
  const normalized = normalizeOpeningHours(hours);
  return normalized
    .map((day, i) => {
      const name = WEEKDAY_LABELS[i].slice(0, 3);
      return day.open ? `${name} ${day.start}–${day.end}` : `${name} fechado`;
    })
    .join('; ');
}

/** Resposta multilinha do bot (menu / pergunta de horário). */
export function formatOpeningHoursLines(hours: unknown): string {
  const normalized = normalizeOpeningHours(hours);
  return normalized
    .map((day, i) => {
      const name = WEEKDAY_LABELS[i];
      return day.open
        ? `${name}: ${day.start}–${day.end}`
        : `${name}: fechado`;
    })
    .join('\n');
}
