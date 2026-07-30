import { PLAN_ENTITLEMENT_DEFAULTS } from '../entitlements/feature-catalog';

export type PlanDefinition = {
  name: string;
  price: number;
  /** Stripe Price ID (assinatura mensal). */
  stripePriceId: string;
  /** Payment Link público (opcional). */
  paymentLinkUrl: string;
  features?: string[];
  entitlements?: Record<string, boolean | number | null>;
};

/**
 * Fallback se a tabela `Plan` estiver vazia (pré-migração / seed).
 * Em operação normal o catálogo vem do Postgres (painel admin).
 */
export const FALLBACK_PLANS: Record<string, PlanDefinition> = {
  Solo: {
    name: 'Solo',
    price: 139,
    stripePriceId: 'price_1TyIuNCYoGJoCsEuE84eG1As',
    paymentLinkUrl: 'https://buy.stripe.com/test_7sYdR84ef16Rf1jgXD7kc04',
    features: [
      'Bot no WhatsApp que agenda sozinho, com menus guiados',
      'Agenda semanal completa (desktop e celular)',
      'Cadastro de serviços, profissionais e clientes',
      'Agendamento manual pelo painel',
      'Bloqueio de agenda (almoço, folga, evento)',
      'Atualização em tempo real, sem recarregar',
      'Portal do profissional (agenda própria, concluir e cancelar)',
      'Menu operacional do profissional no WhatsApp',
      'Cliente agenda e cancela sozinho pelo WhatsApp',
      'Convite e reset de senha da equipe pelo WhatsApp',
      'Suporte por ticket',
      'Até 3 profissionais · 1 número de WhatsApp',
    ],
    entitlements: PLAN_ENTITLEMENT_DEFAULTS.solo,
  },
  Equipe: {
    name: 'Equipe',
    price: 199,
    stripePriceId: 'price_1TyIuQCYoGJoCsEueUsaU6Nv',
    paymentLinkUrl: 'https://buy.stripe.com/test_28E9AS1236rb9GZbDj7kc05',
    features: [
      'Tudo do plano Solo, e mais:',
      'Lembrete automático antes do horário',
      'Faturamento do dia, da semana e do mês',
      'Agendamento recorrente (até 52 repetições)',
      'Atendimento humano com alerta ao vivo',
      'Pausar o bot por cliente ou da conta inteira',
      'Profissional marca cliente e cria bloqueios pelo WhatsApp',
      'Cliente escolhe profissional ou horário primeiro',
      '"Deixa a Sof escolher" o profissional',
      'Frase livre: o bot entende linguagem natural',
      'Cliente pede atendente humano quando quiser',
      'Até 8 profissionais · 1 número de WhatsApp',
    ],
    entitlements: PLAN_ENTITLEMENT_DEFAULTS.equipe,
  },
  Rede: {
    name: 'Rede',
    price: 259,
    stripePriceId: 'price_1TyIuUCYoGJoCsEuD60KobFy',
    paymentLinkUrl: 'https://buy.stripe.com/test_28EcN48uv3eZ8CV8r77kc06',
    features: [
      'Tudo do plano Equipe, e mais:',
      'Agendamento por áudio',
      'Áudio e frase livre também no fluxo do profissional',
      '1 número de WhatsApp (multi-número em breve)',
      'Profissionais ilimitados',
      'Suporte prioritário',
    ],
    entitlements: PLAN_ENTITLEMENT_DEFAULTS.rede,
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
