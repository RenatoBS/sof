import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  HANDOFF_THRESHOLDS,
  WhatsappHandoffsService,
} from './whatsapp-handoffs.service';

function makeService(opts?: {
  threshold?: number | null;
  handoff?: object | null;
}) {
  const prisma = {
    account: {
      findUnique: jest.fn(async () => ({
        whatsappHandoffThreshold: opts?.threshold ?? 2,
      })),
      update: jest.fn(async ({ data }: { data: { whatsappHandoffThreshold: number } }) => ({
        whatsappHandoffThreshold: data.whatsappHandoffThreshold,
      })),
    },
    whatsappHandoff: {
      findFirst: jest.fn(async () => opts?.handoff ?? null),
      update: jest.fn(async ({ data }: { data: object }) => ({
        id: 'h1',
        accountId: 'acc-1',
        status: 'open',
        openedAt: new Date('2026-08-05T12:00:00Z'),
        resolvedAt: null,
        ...data,
      })),
    },
  };
  const realtime = { broadcast: jest.fn() };
  const entitlements = {
    forAccount: jest.fn(async () => ({ handoffs: true })),
  };
  const service = new WhatsappHandoffsService(
    prisma as never,
    realtime as never,
    entitlements as never,
  );
  return { service, prisma, realtime };
}

describe('WhatsappHandoffsService.normalizeThreshold', () => {
  it('aceita valores da lista e cai em 2 no resto', () => {
    const { service } = makeService();
    for (const n of HANDOFF_THRESHOLDS) {
      expect(service.normalizeThreshold(n)).toBe(n);
    }
    expect(service.normalizeThreshold(99)).toBe(2);
    expect(service.normalizeThreshold(null)).toBe(2);
    expect(service.normalizeThreshold(undefined)).toBe(2);
  });
});

describe('WhatsappHandoffsService.getSettings / updateSettings', () => {
  it('getSettings devolve threshold + allowed', async () => {
    const { service } = makeService({ threshold: 3 });
    await expect(service.getSettings('acc-1')).resolves.toEqual({
      threshold: 3,
      allowed: [...HANDOFF_THRESHOLDS],
    });
  });

  it('updateSettings persiste threshold válido', async () => {
    const { service, prisma } = makeService();
    const out = await service.updateSettings('acc-1', 5);
    expect(out.threshold).toBe(5);
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { whatsappHandoffThreshold: 5 },
    });
  });

  it('updateSettings rejeita limiar inválido após normalize impossível', async () => {
    const { service } = makeService();
    // normalizeThreshold(4) → 2, que é válido — força via spy
    const spy = jest
      .spyOn(service, 'normalizeThreshold')
      .mockReturnValue(4 as never);
    await expect(service.updateSettings('acc-1', 4)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    spy.mockRestore();
  });
});

describe('WhatsappHandoffsService.resolveManual', () => {
  it('404 se handoff não existe', async () => {
    const { service } = makeService({ handoff: null });
    await expect(service.resolveManual('acc-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolve open e emite realtime', async () => {
    const { service, prisma, realtime } = makeService({
      handoff: {
        id: 'h1',
        accountId: 'acc-1',
        status: 'open',
        openedAt: new Date(),
        resolvedAt: null,
      },
    });
    const shaped = await service.resolveManual('acc-1', 'h1');
    expect(shaped.status).toBe('resolved');
    expect(prisma.whatsappHandoff.update).toHaveBeenCalled();
    expect(realtime.broadcast).toHaveBeenCalledWith(
      'acc-1',
      'whatsapp-handoff:resolved',
      expect.objectContaining({ handoff: expect.any(Object) }),
    );
  });

  it('idempotente se já resolved', async () => {
    const existing = {
      id: 'h1',
      accountId: 'acc-1',
      status: 'resolved',
      openedAt: new Date(),
      resolvedAt: new Date(),
    };
    const { service, prisma } = makeService({ handoff: existing });
    const out = await service.resolveManual('acc-1', 'h1');
    expect(out.status).toBe('resolved');
    expect(prisma.whatsappHandoff.update).not.toHaveBeenCalled();
  });
});
