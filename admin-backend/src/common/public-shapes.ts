export function slugifyPlanName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function publicAdmin(admin: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    createdAt: admin.createdAt,
  };
}

export function publicAccount(account: {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  plan: string;
  planPrice: number;
  status: string;
  createdAt: Date;
  whatsappConnectedAt: Date | null;
  timezone: string;
}) {
  return {
    id: account.id,
    businessName: account.businessName,
    ownerName: account.ownerName,
    email: account.email,
    phone: account.phone || '',
    plan: account.plan,
    planPrice: account.planPrice,
    status: account.status,
    createdAt: account.createdAt,
    whatsappConnected: Boolean(account.whatsappConnectedAt),
    timezone: account.timezone,
  };
}

export function publicPlan(plan: {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  interval: string;
  stripeProductId: string;
  stripePriceId: string;
  paymentLinkUrl: string;
  features: unknown;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    price: plan.price,
    currency: plan.currency,
    interval: plan.interval,
    stripeProductId: plan.stripeProductId,
    stripePriceId: plan.stripePriceId,
    paymentLinkUrl: plan.paymentLinkUrl,
    features: Array.isArray(plan.features)
      ? plan.features.filter((f): f is string => typeof f === 'string')
      : [],
    active: plan.active,
    sortOrder: plan.sortOrder,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}
