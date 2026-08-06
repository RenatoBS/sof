import { FALLBACK_PLANS, getPlan, slugifyPlanName } from './plans';

describe('slugifyPlanName', () => {
  it('normaliza acentos e espaços', () => {
    expect(slugifyPlanName('Equipe')).toBe('equipe');
    expect(slugifyPlanName('Estúdio')).toBe('estudio');
    expect(slugifyPlanName('  Rede Premium  ')).toBe('rede-premium');
  });
});

describe('getPlan', () => {
  it('resolve planos fallback Solo/Equipe/Rede', () => {
    expect(getPlan('Solo')?.name).toBe('Solo');
    expect(getPlan('Equipe')?.price).toBe(FALLBACK_PLANS.Equipe.price);
    expect(getPlan('Rede')?.entitlements).toBeDefined();
  });

  it('retorna null para nome desconhecido', () => {
    expect(getPlan('Inexistente')).toBeNull();
  });
});
