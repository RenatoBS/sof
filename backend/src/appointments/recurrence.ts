const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export type RecurrenceInput = {
  frequency: RecurrenceFrequency;
  until: string;
};

const MAX_OCCURRENCES = 52;

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/** Lê `body.recurrence` — ausente/none = só a data inicial. */
export function parseRecurrenceInput(
  body: Record<string, unknown>,
): RecurrenceInput | null | { error: string } {
  const raw = body?.recurrence;
  if (raw == null || raw === '' || raw === false) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Recorrência inválida.' };
  }
  const row = raw as Record<string, unknown>;
  const frequency = String(row.frequency || '').trim().toLowerCase();
  if (!frequency || frequency === 'none') return null;
  if (
    frequency !== 'daily' &&
    frequency !== 'weekly' &&
    frequency !== 'monthly'
  ) {
    return { error: 'Frequência de recorrência inválida.' };
  }
  const until = String(row.until || '').trim();
  if (!DATE_RE.test(until)) {
    return { error: 'Informe a data final da recorrência (AAAA-MM-DD).' };
  }
  return { frequency, until };
}

/**
 * Expande datas da série (inclui `startDate`).
 * Limite: 52 ocorrências; `until` inclusivo.
 */
export function expandRecurrenceDates(
  startDate: string,
  recurrence: RecurrenceInput | null,
): string[] | { error: string } {
  if (!recurrence) return [startDate];
  if (!DATE_RE.test(startDate)) return { error: 'Data inválida.' };

  const start = parseDate(startDate);
  const until = parseDate(recurrence.until);
  if (until < start) {
    return { error: 'A data final da recorrência deve ser após a data inicial.' };
  }

  const dates: string[] = [startDate];
  let cursor = new Date(start);

  while (dates.length < MAX_OCCURRENCES) {
    if (recurrence.frequency === 'daily') {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    } else if (recurrence.frequency === 'weekly') {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor = addMonthsClamped(start, dates.length);
    }

    if (cursor > until) break;
    dates.push(toIso(cursor));
  }

  if (dates.length >= MAX_OCCURRENCES) {
    const last = parseDate(dates[dates.length - 1]);
    if (last < until) {
      return {
        error: `A recorrência gera mais de ${MAX_OCCURRENCES} ocorrências. Reduza o período.`,
      };
    }
  }

  return dates;
}
