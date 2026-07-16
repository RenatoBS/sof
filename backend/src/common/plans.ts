export type PlanDefinition = {
  name: string;
  price: number;
  /** Stripe Price ID (assinatura mensal, sandbox). */
  stripePriceId: string;
  /** Payment Link público (sandbox). */
  paymentLinkUrl: string;
};

export const PLANS: Record<string, PlanDefinition> = {
  Essencial: {
    name: 'Essencial',
    price: 99,
    stripePriceId: 'price_1TteV5CYoGJoCsEuADctlxcK',
    paymentLinkUrl: 'https://buy.stripe.com/test_14A3cu12302NbP77n37kc00',
  },
  Estúdio: {
    name: 'Estúdio',
    price: 197,
    stripePriceId: 'price_1TteV6CYoGJoCsEujB5IupLf',
    paymentLinkUrl: 'https://buy.stripe.com/test_6oUaEWbGH02N3iB6iZ7kc01',
  },
  Rede: {
    name: 'Rede',
    price: 249,
    stripePriceId: 'price_1TteV6CYoGJoCsEu8Pj2HeUo',
    paymentLinkUrl: 'https://buy.stripe.com/test_eVq8wO6mn4j31atfTz7kc02',
  },
};

export function getPlan(planName: string) {
  return PLANS[planName] || null;
}
