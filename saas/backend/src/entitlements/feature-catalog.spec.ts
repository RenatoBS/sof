import {
  defaultsForPlanSlug,
  hasFeature,
  limitValue,
  mergeEntitlements,
  PLAN_ENTITLEMENT_DEFAULTS,
} from './feature-catalog';

describe('defaultsForPlanSlug', () => {
  it('aplica defaults de Equipe e alias legado', () => {
    const equipe = defaultsForPlanSlug('equipe');
    expect(equipe.handoffs).toBe(true);
    expect(equipe.maxEmployees).toBe(8);

    const alias = defaultsForPlanSlug('estudio');
    expect(alias.billing).toBe(true);
  });

  it('cai em Solo para slug desconhecido', () => {
    const solo = defaultsForPlanSlug('xyz');
    expect(solo.handoffs).toBe(false);
    expect(solo.maxEmployees).toBe(PLAN_ENTITLEMENT_DEFAULTS.solo.maxEmployees);
  });
});

describe('mergeEntitlements', () => {
  it('sobrescreve só keys do catálogo', () => {
    const base = defaultsForPlanSlug('solo');
    const merged = mergeEntitlements(
      { handoffs: true, unknownKey: true, maxEmployees: null },
      base,
    );
    expect(merged.handoffs).toBe(true);
    expect(merged.maxEmployees).toBeNull();
    expect((merged as Record<string, unknown>).unknownKey).toBeUndefined();
  });

  it('ignora stored inválido', () => {
    const base = defaultsForPlanSlug('solo');
    expect(mergeEntitlements(null, base)).toEqual(base);
    expect(mergeEntitlements(['x'], base)).toEqual(base);
  });
});

describe('hasFeature / limitValue', () => {
  const equipe = defaultsForPlanSlug('equipe');
  const rede = defaultsForPlanSlug('rede');

  it('hasFeature para boolean e limite null', () => {
    expect(hasFeature(equipe, 'handoffs')).toBe(true);
    expect(hasFeature(defaultsForPlanSlug('solo'), 'handoffs')).toBe(false);
    expect(hasFeature(rede, 'maxEmployees')).toBe(true); // null = ilimitado
  });

  it('limitValue devolve número ou null', () => {
    expect(limitValue(equipe, 'maxEmployees')).toBe(8);
    expect(limitValue(rede, 'maxEmployees')).toBeNull();
    expect(limitValue(equipe, 'handoffs')).toBe(0);
  });
});
