import { RemindersService } from './reminders.service';

describe('RemindersService.tryClaim', () => {
  it('só um claim vence quando dois ticks disputam o mesmo id', async () => {
    let claimed = false;
    const prisma = {
      $executeRaw: jest.fn(async () => {
        if (claimed) return 0;
        claimed = true;
        return 1;
      }),
      appointment: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    const whatsapp = { sendText: jest.fn() };
    const service = new RemindersService(
      prisma as never,
      whatsapp as never,
      {
        forAccount: async () => ({ reminders: true }),
      } as never,
    );

    const [a, b] = await Promise.all([
      service.tryClaim('appt-1'),
      service.tryClaim('appt-1'),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });
});

describe('RemindersService.processDueReminders', () => {
  function makeService(opts: { sendText: jest.Mock; claimResults?: number[] }) {
    let claimIdx = 0;
    const updates: object[] = [];
    const prisma = {
      $executeRaw: jest.fn(async () => {
        const results = opts.claimResults || [1];
        const value = results[Math.min(claimIdx, results.length - 1)];
        claimIdx += 1;
        return value;
      }),
      $queryRaw: jest.fn(async () => [
        {
          id: 'appt-1',
          accountId: 'acc-1',
          clientName: 'Maria',
          clientPhone: '5511999998888',
          // 15:00 BRT = 18:00 UTC; lead 2h → due from 16:00 UTC
          date: '2026-07-21',
          time: '15:00',
          reminderClaimedAt: null,
          reminderSentAt: null,
          businessName: 'Salão',
          address: '',
          timezone: 'America/Sao_Paulo',
          whatsappReminderMinutes: 120,
          whatsappInstanceToken: 'tok',
          serviceName: 'Corte',
          employeeName: 'Ana',
        },
      ]),
      appointment: {
        update: jest.fn(async ({ data }: { data: object }) => {
          updates.push(data);
        }),
        updateMany: jest.fn(async ({ data }: { data: object }) => {
          updates.push(data);
        }),
      },
    };
    const service = new RemindersService(
      prisma as never,
      { sendText: opts.sendText } as never,
      { forAccount: async () => ({ reminders: true }) } as never,
    );
    return { service, prisma, updates };
  }

  it('libera claim em falha e marca reminderSentAt só no sucesso', async () => {
    const sendText = jest
      .fn()
      .mockRejectedValueOnce(new Error('uazapi down'))
      .mockResolvedValueOnce(undefined);

    const now = new Date('2026-07-21T16:30:00.000Z');

    const first = makeService({ sendText, claimResults: [1] });
    const failStats = await first.service.processDueReminders(now);
    expect(failStats.failed).toBe(1);
    expect(first.prisma.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reminderClaimedAt: null },
      }),
    );

    const second = makeService({ sendText, claimResults: [1] });
    const okStats = await second.service.processDueReminders(now);
    expect(okStats.sent).toBe(1);
    expect(sendText).toHaveBeenCalledTimes(2);
    expect(second.prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reminderSentAt: now },
      }),
    );
  });

  it('não reenvia se reminderSentAt já existir (candidate query vazia)', async () => {
    const sendText = jest.fn();
    const { service, prisma } = makeService({ sendText });
    prisma.$queryRaw = jest.fn(async () => []);
    const stats = await service.processDueReminders(
      new Date('2026-07-21T16:30:00.000Z'),
    );
    expect(stats).toEqual({
      scanned: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
    expect(sendText).not.toHaveBeenCalled();
  });
});
