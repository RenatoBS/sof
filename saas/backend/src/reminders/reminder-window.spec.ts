import {
  addDaysToDateString,
  buildReminderMessage,
  formatReminderLeadLabel,
  isReminderDue,
  isValidIanaTimeZone,
  normalizeReminderLeadMinutes,
  zonedWallTimeToUtc,
} from './reminder-window';

describe('reminder-window', () => {
  it('valida fusos IANA', () => {
    expect(isValidIanaTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidIanaTimeZone('Not/AZone')).toBe(false);
  });

  it('normaliza antecedência permitida', () => {
    expect(normalizeReminderLeadMinutes(120)).toBe(120);
    expect(normalizeReminderLeadMinutes(0)).toBe(0);
    expect(normalizeReminderLeadMinutes(90)).toBeNull();
  });

  it('converte horário de parede SP para UTC (UTC-3)', () => {
    const utc = zonedWallTimeToUtc(
      '2026-07-21',
      '15:00',
      'America/Sao_Paulo',
    );
    expect(utc).not.toBeNull();
    // 15:00 BRT = 18:00 UTC
    expect(utc!.toISOString()).toBe('2026-07-21T18:00:00.000Z');
  });

  it('marca lembrete como due apenas entre (start-lead) e start', () => {
    const startAt = new Date('2026-07-21T18:00:00.000Z');
    const leadMinutes = 120;

    expect(
      isReminderDue({
        now: new Date('2026-07-21T15:59:00.000Z'),
        startAt,
        leadMinutes,
      }),
    ).toBe(false);

    expect(
      isReminderDue({
        now: new Date('2026-07-21T16:00:00.000Z'),
        startAt,
        leadMinutes,
      }),
    ).toBe(true);

    expect(
      isReminderDue({
        now: new Date('2026-07-21T17:59:00.000Z'),
        startAt,
        leadMinutes,
      }),
    ).toBe(true);

    expect(
      isReminderDue({
        now: new Date('2026-07-21T18:00:00.000Z'),
        startAt,
        leadMinutes,
      }),
    ).toBe(false);

    expect(
      isReminderDue({
        now: new Date('2026-07-21T16:00:00.000Z'),
        startAt,
        leadMinutes: 0,
      }),
    ).toBe(false);
  });

  it('formata rótulo e mensagem', () => {
    expect(formatReminderLeadLabel(60)).toBe('1 hora');
    expect(formatReminderLeadLabel(120)).toBe('2 horas');
    expect(addDaysToDateString('2026-07-31', 1)).toBe('2026-08-01');

    const msg = buildReminderMessage({
      clientName: 'Maria',
      businessName: 'Santa Madalena',
      serviceName: 'Corte',
      employeeName: 'Marcelo',
      date: '2026-07-22',
      time: '15:00',
      address: 'Rua A, 1',
    });
    expect(msg).toContain('Oi, Maria!');
    expect(msg).toContain('Corte com Marcelo');
    expect(msg).toContain('22/07/2026 às 15:00');
    expect(msg).toContain('Endereço: Rua A, 1');
  });
});
