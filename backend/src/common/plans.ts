export type PlanDefinition = {
  name: string;
  price: number;
  /** Stripe Price ID (assinatura mensal). */
  stripePriceId: string;
  /** Payment Link público (opcional). */
  paymentLinkUrl: string;
  features?: string[];
};

/**
 * Fallback legado se a tabela `Plan` estiver vazia (pré-migração / seed).
 * Em operação normal o catálogo vem do Postgres (painel admin).
 */
export const FALLBACK_PLANS: Record<string, PlanDefinition> = {
  Essencial: {
    name: 'Essencial',
    price: 99,
    stripePriceId: 'price_1TteV5CYoGJoCsEuADctlxcK',
    paymentLinkUrl: 'https://buy.stripe.com/test_14A3cu12302NbP77n37kc00',
    features: [
      'Até 3 profissionais',
      '1 número de WhatsApp',
      'Agendamentos ilimitados',
      'Painel de agenda',
      'Suporte por e-mail',
    ],
  },
  Estúdio: {
    name: 'Estúdio',
    price: 197,
    stripePriceId: 'price_1TteV6CYoGJoCsEujB5IupLf',
    paymentLinkUrl: 'https://buy.stripe.com/test_6oUaEWbGH02N3iB6iZ7kc01',
    features: [
      'Até 7 profissionais',
      '2 números de WhatsApp',
      'Lembrete por WhatsApp',
      'Relatório de faturamento',
      'Suporte prioritário',
    ],
  },
  Rede: {
    name: 'Rede',
    price: 249,
    stripePriceId: 'price_1TteV6CYoGJoCsEu8Pj2HeUo',
    paymentLinkUrl: 'https://buy.stripe.com/test_eVq8wO6mn4j31atfTz7kc02',
    features: [
      'A partir de 8 profissionais',
      'Vários números de WhatsApp',
      'Relatório por unidade',
      'Integrações sob medida',
      'Suporte dedicado',
    ],
  },
};

/** @deprecated use PlansService.getByName */
export const PLANS = FALLBACK_PLANS;

/** @deprecated use PlansService.getByName */
export function getPlan(planName: string) {
  return FALLBACK_PLANS[planName] || null;
}

export function slugifyPlanName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
