import { api } from './client';

export type Admin = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type AccountRow = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  plan: string;
  planPrice: number;
  planId?: string | null;
  status: string;
  createdAt: string;
  whatsappConnected: boolean;
  timezone: string;
  billingSource?: string;
  promoExpiresAt?: string | null;
};

export type EntitlementsMap = Record<string, boolean | number | null>;

export type FeatureCatalogItem = {
  key: string;
  label: string;
  type: 'boolean' | 'limit';
  description: string;
  status: 'active' | 'stub';
  defaultValue: boolean | number | null;
};

export type PlanRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  interval: string;
  stripeProductId: string;
  stripePriceId: string;
  paymentLinkUrl: string;
  features: string[];
  entitlements: EntitlementsMap;
  active: boolean;
  sortOrder: number;
  accountCount?: number;
  createdAt: string;
  updatedAt: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    api<{ admin: Admin; token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  logout: () => api<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => api<{ admin: Admin }>('/auth/me'),
};

export const accountsApi = {
  list: (params?: { q?: string; status?: string; planId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.planId) qs.set('planId', params.planId);
    const suffix = qs.toString() ? `?${qs}` : '';
    return api<{ total: number; accounts: AccountRow[] }>(`/accounts${suffix}`);
  },
  get: (id: string) =>
    api<{
      account: AccountRow;
      stats: { employees: number; appointments: number };
    }>(`/accounts/${id}`),
  create: (body: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string;
    password?: string;
    plan: string;
    planPrice: number;
    status?: string;
  }) =>
    api<{ account: AccountRow; temporaryPassword?: string }>('/accounts', {
      method: 'POST',
      body,
    }),
  update: (
    id: string,
    body: Partial<{
      businessName: string;
      ownerName: string;
      email: string;
      phone: string;
      plan: string;
      planPrice: number;
      status: string;
    }>,
  ) =>
    api<{ account: AccountRow }>(`/accounts/${id}`, {
      method: 'PUT',
      body,
    }),
  resetPassword: (id: string) =>
    api<{ ok: boolean; temporaryPassword: string }>(
      `/accounts/${id}/reset-password`,
      { method: 'POST' },
    ),
};

export const plansApi = {
  list: () =>
    api<{ plans: PlanRow[]; stripeConfigured: boolean }>('/plans'),
  create: (body: {
    name: string;
    price: number;
    interval?: string;
    features?: string[];
    entitlements?: EntitlementsMap;
    sortOrder?: number;
    active?: boolean;
    paymentLinkUrl?: string;
    syncStripe?: boolean;
    stripeProductId?: string;
    stripePriceId?: string;
  }) =>
    api<{ plan: PlanRow }>('/plans', { method: 'POST', body }),
  update: (
    id: string,
    body: Partial<{
      name: string;
      price: number;
      interval: string;
      features: string[];
      entitlements: EntitlementsMap;
      sortOrder: number;
      active: boolean;
      paymentLinkUrl: string;
      syncStripe: boolean;
    }>,
  ) =>
    api<{ plan: PlanRow }>(`/plans/${id}`, { method: 'PUT', body }),
  syncStripe: (id: string) =>
    api<{ plan: PlanRow }>(`/plans/${id}/sync-stripe`, { method: 'POST' }),
  remove: (id: string) =>
    api<{ ok: boolean }>(`/plans/${id}`, { method: 'DELETE' }),
};

export const featureCatalogApi = {
  list: () =>
    api<{ features: FeatureCatalogItem[] }>('/feature-catalog'),
};

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type CouponRedemptionRow = {
  id: string;
  redeemedAt: string;
  expiresAt: string;
  account: {
    id: string;
    businessName: string;
    email: string;
    status: string;
    billingSource: string;
    promoExpiresAt: string | null;
  };
};

export type CouponRow = {
  id: string;
  code: string;
  planId: string;
  planName: string | null;
  planPrice: number | null;
  freeDays: number;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  active: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
  redemptions?: CouponRedemptionRow[];
};

export const couponsApi = {
  list: () => api<{ coupons: CouponRow[] }>('/coupons'),
  get: (id: string) => api<{ coupon: CouponRow }>(`/coupons/${id}`),
  create: (body: {
    code: string;
    planId: string;
    freeDays: number;
    maxUses: number;
    note?: string;
    active?: boolean;
  }) => api<{ coupon: CouponRow }>('/coupons', { method: 'POST', body }),
  update: (
    id: string,
    body: Partial<{ maxUses: number; note: string; active: boolean }>,
  ) => api<{ coupon: CouponRow }>(`/coupons/${id}`, { method: 'PUT', body }),
  remove: (id: string) =>
    api<{ ok: boolean }>(`/coupons/${id}`, { method: 'DELETE' }),
};

export type TicketComment = {
  id: string;
  body: string;
  authorRole: string;
  authorName: string;
  createdAt: string;
};

export type TicketRow = {
  id: string;
  accountId: string;
  title: string;
  description: string;
  status: string;
  createdByRole: string;
  createdByName: string;
  account?: { id: string; businessName: string; email: string };
  commentCount: number;
  comments?: TicketComment[];
  createdAt: string;
  updatedAt: string;
};

export const ticketsApi = {
  list: (params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs}` : '';
    return api<{ total: number; tickets: TicketRow[] }>(`/tickets${suffix}`);
  },
  get: (id: string) => api<{ ticket: TicketRow }>(`/tickets/${id}`),
  comment: (id: string, body: string) =>
    api<{ comment: TicketComment }>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: { body },
    }),
  updateStatus: (id: string, status: TicketStatus) =>
    api<{ ticket: TicketRow }>(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
};
