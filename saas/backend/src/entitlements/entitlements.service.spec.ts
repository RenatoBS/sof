import { NotFoundException } from '@nestjs/common';
import {
  EntitlementsService,
  PlanGateException,
} from './entitlements.service';

function makeService(account: unknown) {
  const prisma = {
    account: {
      findUnique: jest.fn(async () => account),
    },
  };
  return {
    service: new EntitlementsService(prisma as never),
    prisma,
  };
}

describe('EntitlementsService', () => {
  it('forAccount lança NotFound se conta sumiu', async () => {
    const { service } = makeService(null);
    await expect(service.forAccount('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('forAccount usa planRef.entitlements mesclado com defaults do slug', async () => {
    const { service } = makeService({
      plan: 'Equipe',
      planId: 'plan-1',
      planRef: {
        slug: 'equipe',
        name: 'Equipe',
        entitlements: { maxEmployees: 4 },
      },
    });
    const ents = await service.forAccount('acc-1');
    expect(ents.handoffs).toBe(true);
    expect(ents.maxEmployees).toBe(4);
  });

  it('resolveFromAccount cai no snapshot do nome quando sem planRef', () => {
    const { service } = makeService(null);
    const ents = service.resolveFromAccount({
      plan: 'Solo',
      planId: null,
    });
    expect(ents.handoffs).toBe(false);
    expect(ents.maxEmployees).toBe(3);
  });

  it('assertFeature bloqueia recurso ausente', async () => {
    const { service } = makeService({
      plan: 'Solo',
      planId: null,
      planRef: null,
    });
    await expect(service.assertFeature('acc-1', 'handoffs')).rejects.toBeInstanceOf(
      PlanGateException,
    );
  });

  it('assertFeature libera quando o plano tem o recurso', async () => {
    const { service } = makeService({
      plan: 'Equipe',
      planId: 'p1',
      planRef: {
        slug: 'equipe',
        name: 'Equipe',
        entitlements: {},
      },
    });
    const ents = await service.assertFeature('acc-1', 'handoffs');
    expect(ents.handoffs).toBe(true);
  });

  it('assertLimit bloqueia quando current >= limite', async () => {
    const { service } = makeService({
      plan: 'Solo',
      planId: null,
      planRef: {
        slug: 'solo',
        name: 'Solo',
        entitlements: { maxEmployees: 3 },
      },
    });
    await expect(service.assertLimit('acc-1', 'maxEmployees', 3)).rejects.toBeInstanceOf(
      PlanGateException,
    );
  });

  it('assertLimit libera abaixo do limite ou ilimitado', async () => {
    const { service } = makeService({
      plan: 'Rede',
      planId: 'p',
      planRef: {
        slug: 'rede',
        name: 'Rede',
        entitlements: { maxEmployees: null },
      },
    });
    await expect(
      service.assertLimit('acc-1', 'maxEmployees', 99),
    ).resolves.toBeDefined();
  });

  it('effectiveWhatsappLimit cap em 1', () => {
    const { service } = makeService(null);
    expect(service.effectiveWhatsappLimit({ maxWhatsappNumbers: 5 })).toBe(1);
    expect(service.effectiveWhatsappLimit({ maxWhatsappNumbers: null })).toBe(1);
    expect(service.effectiveWhatsappLimit({ maxWhatsappNumbers: 0 })).toBe(0);
  });
});
