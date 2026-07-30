/** Valores permitidos de antecedência do lembrete (0 = desativado). */
export const REMINDER_LEAD_MINUTES = [0, 60, 120, 180, 360, 1440] as const;
export type ReminderLeadMinutes = (typeof REMINDER_LEAD_MINUTES)[number];

export const DEFAULT_REMINDER_LEAD_MINUTES = 120;
export const DEFAULT_ACCOUNT_TIMEZONE = 'America/Sao_Paulo';

/** Fusos IANA brasileiros oferecidos no painel. */
export const ACCOUNT_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Belem',
  'America/Manaus',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
] as const;

export type AccountTimezone = (typeof ACCOUNT_TIMEZONES)[number];

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function normalizeReminderLeadMinutes(
  value: unknown,
): ReminderLeadMinutes | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if ((REMINDER_LEAD_MINUTES as readonly number[]).includes(n)) {
    return n as ReminderLeadMinutes;
  }
  return null;
}

export function normalizeAccountTimezone(value: unknown): string | null {
  const tz = String(value || '').trim();
  if (!tz) return null;
  if (!isValidIanaTimeZone(tz)) return null;
  return tz;
}

/** Offset (ms) de `date` no fuso: local-as-UTC − instant real. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/**
 * Converte data+hora de parede (`YYYY-MM-DD` + `HH:MM`) no fuso da conta
 * para um instante UTC.
 */
export function zonedWallTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  if (!isValidIanaTimeZone(timeZone)) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = new Date(utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone));
  // Corrige edge de DST (se o offset mudou após o primeiro ajuste).
  const offset2 = getTimeZoneOffsetMs(utc, timeZone);
  utc = new Date(utcGuess - offset2);
  return utc;
}

/** YYYY-MM-DD no fuso informado. */
export function dateStringInTimeZone(now: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(now);
}

export function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * O lembrete deve sair agora se já passou o instante (início − lead)
 * e o atendimento ainda não começou.
 */
export function isReminderDue(opts: {
  now: Date;
  startAt: Date;
  leadMinutes: number;
}): boolean {
  if (opts.leadMinutes <= 0) return false;
  if (opts.now.getTime() >= opts.startAt.getTime()) return false;
  const dueAt = opts.startAt.getTime() - opts.leadMinutes * 60_000;
  return opts.now.getTime() >= dueAt;
}

export function formatReminderLeadLabel(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} minutos`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  return `${minutes} minutos`;
}

export function buildReminderMessage(opts: {
  clientName: string;
  businessName: string;
  serviceName: string;
  employeeName: string;
  date: string;
  time: string;
  address?: string;
}): string {
  const name = (opts.clientName || '').trim() || 'olá';
  const when = formatFriendlyWhen(opts.date, opts.time);
  const service = opts.serviceName || 'seu horário';
  const withWho = opts.employeeName ? ` com ${opts.employeeName}` : '';
  const lines = [
    `Oi, ${name}! Lembrete da ${opts.businessName}:`,
    `${service}${withWho} — ${when}.`,
  ];
  const address = (opts.address || '').trim();
  if (address) lines.push(`Endereço: ${address}`);
  lines.push('Até lá!');
  return lines.join('\n');
}

function formatFriendlyWhen(date: string, time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return `${date} às ${time}`;
  const [, y, m, d] = match;
  return `${d}/${m}/${y} às ${time}`;
}
