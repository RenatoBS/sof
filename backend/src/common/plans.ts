export const PLANS: Record<string, { name: string; price: number }> = {
  Essencial: { name: 'Essencial', price: 99 },
  Estúdio: { name: 'Estúdio', price: 197 },
  Rede: { name: 'Rede', price: 249 },
};

export function getPlan(planName: string) {
  return PLANS[planName] || null;
}
