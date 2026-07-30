/**
 * Catálogo de features gateáveis por plano.
 * Keys vivem no código (hooks de enforcement); valores por plano no admin (`Plan.entitlements`).
 */

export type FeatureValue = boolean | number | null;

export type FeatureDef = {
  key: string;
  label: string;
  type: 'boolean' | 'limit';
  description: string;
  /** active = enforced; stub = key existe, feature incompleta / backlog */
  status: 'active' | 'stub';
  /** Default quando o plano não define a key */
  defaultValue: FeatureValue;
};

export const FEATURE_CATALOG: FeatureDef[] = [
  {
    key: 'maxEmployees',
    label: 'Máx. profissionais',
    type: 'limit',
    description: 'Limite de profissionais ativos na conta (null = ilimitado).',
    status: 'active',
    defaultValue: 3,
  },
  {
    key: 'maxWhatsappNumbers',
    label: 'Máx. números WhatsApp',
    type: 'limit',
    description:
      'Limite de números WhatsApp. Multi-instância ainda não existe: connect efetivo é min(limite, 1).',
    status: 'stub',
    defaultValue: 1,
  },
  {
    key: 'reminders',
    label: 'Lembretes automáticos',
    type: 'boolean',
    description: 'Lembrete WhatsApp antes do horário.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'billing',
    label: 'Faturamento',
    type: 'boolean',
    description: 'Relatório de faturamento (dia / semana / mês).',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'recurrence',
    label: 'Agendamento recorrente',
    type: 'boolean',
    description: 'Criar série recorrente (até 52 ocorrências).',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'handoffs',
    label: 'Atendimento humano',
    type: 'boolean',
    description: 'Handoffs: bot passa o cliente para a equipe.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'botPause',
    label: 'Pausar bot',
    type: 'boolean',
    description: 'Pausar bot por cliente ou conta inteira.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'employeeWhatsappBookBlock',
    label: 'Profissional agenda/bloqueia no WhatsApp',
    type: 'boolean',
    description: 'Menu do profissional: marcar cliente e criar bloqueios.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'bookingPathChoice',
    label: 'Escolher caminho (prof. ou horário)',
    type: 'boolean',
    description: 'Cliente escolhe profissional ou horário primeiro no bot.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'sofPickProfessional',
    label: 'Deixa a Sof escolher',
    type: 'boolean',
    description: 'Opção automática de profissional no bot.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'freeTextNlu',
    label: 'Frase livre (NLU)',
    type: 'boolean',
    description: 'Cliente escreve em linguagem natural e o bot entende.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'clientRequestHuman',
    label: 'Cliente pede humano',
    type: 'boolean',
    description: 'Cliente solicita atendente humano no WhatsApp.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'audioBooking',
    label: 'Agendamento por áudio',
    type: 'boolean',
    description: 'Cliente manda áudio e o bot agenda (Uazapi + OpenAI).',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'employeeFreeTextAudio',
    label: 'Áudio/frase livre do profissional',
    type: 'boolean',
    description: 'NLU e áudio também no fluxo do profissional.',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'supportPriority',
    label: 'Suporte prioritário',
    type: 'boolean',
    description: 'Badge de prioridade na UI de tickets (sem SLA/fila).',
    status: 'active',
    defaultValue: false,
  },
  {
    key: 'clientReschedule',
    label: 'Remarcação pelo cliente',
    type: 'boolean',
    description:
      'Fluxo dedicado de remarcar no WhatsApp (débito técnico; ainda não implementado).',
    status: 'stub',
    defaultValue: false,
  },
];

export const FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key);

export type EntitlementsMap = Record<string, FeatureValue>;

/** Defaults Solo / Equipe / Rede (admin pode sobrescrever). */
export const PLAN_ENTITLEMENT_DEFAULTS: Record<string, EntitlementsMap> = {
  solo: {
    maxEmployees: 3,
    maxWhatsappNumbers: 1,
    reminders: false,
    billing: false,
    recurrence: false,
    handoffs: false,
    botPause: false,
    employeeWhatsappBookBlock: false,
    bookingPathChoice: false,
    sofPickProfessional: false,
    freeTextNlu: false,
    clientRequestHuman: false,
    audioBooking: false,
    employeeFreeTextAudio: false,
    supportPriority: false,
    clientReschedule: false,
  },
  equipe: {
    maxEmployees: 8,
    maxWhatsappNumbers: 1,
    reminders: true,
    billing: true,
    recurrence: true,
    handoffs: true,
    botPause: true,
    employeeWhatsappBookBlock: true,
    bookingPathChoice: true,
    sofPickProfessional: true,
    freeTextNlu: true,
    clientRequestHuman: true,
    audioBooking: false,
    employeeFreeTextAudio: false,
    supportPriority: false,
    clientReschedule: false,
  },
  rede: {
    maxEmployees: null,
    maxWhatsappNumbers: 1,
    reminders: true,
    billing: true,
    recurrence: true,
    handoffs: true,
    botPause: true,
    employeeWhatsappBookBlock: true,
    bookingPathChoice: true,
    sofPickProfessional: true,
    freeTextNlu: true,
    clientRequestHuman: true,
    audioBooking: true,
    employeeFreeTextAudio: true,
    supportPriority: true,
    clientReschedule: false,
  },
};

/** Aliases de nomes legados → slug do plano atual. */
export const PLAN_NAME_ALIASES: Record<string, string> = {
  essencial: 'solo',
  estudio: 'equipe',
  estúdio: 'equipe',
  solo: 'solo',
  equipe: 'equipe',
  rede: 'rede',
};

export function catalogDefaults(): EntitlementsMap {
  const out: EntitlementsMap = {};
  for (const f of FEATURE_CATALOG) {
    out[f.key] = f.defaultValue;
  }
  return out;
}

export function defaultsForPlanSlug(slug: string): EntitlementsMap {
  const key = slug.toLowerCase();
  const aliased = PLAN_NAME_ALIASES[key] || key;
  return {
    ...catalogDefaults(),
    ...(PLAN_ENTITLEMENT_DEFAULTS[aliased] || PLAN_ENTITLEMENT_DEFAULTS.solo),
  };
}

export function mergeEntitlements(
  stored: unknown,
  base?: EntitlementsMap,
): EntitlementsMap {
  const out: EntitlementsMap = { ...(base || catalogDefaults()) };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return out;
  }
  for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
    if (!FEATURE_KEYS.includes(k)) continue;
    if (v === null) {
      out[k] = null;
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v;
    }
  }
  return out;
}

export function sanitizeEntitlementsInput(raw: unknown): EntitlementsMap {
  return mergeEntitlements(raw, {});
}

export function hasFeature(ents: EntitlementsMap, key: string): boolean {
  const v = ents[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null) return true; // unlimited limit ⇒ “has”
  return false;
}

export function limitValue(ents: EntitlementsMap, key: string): number | null {
  const v = ents[key];
  if (v === null) return null;
  if (typeof v === 'number') return v;
  return 0;
}
