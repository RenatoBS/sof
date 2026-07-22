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
  status: string;
  createdAt: string;
  whatsappConnected: boolean;
  timezone: string;
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
  active: boolean;
  sortOrder: number;
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
  list: (params?: { q?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
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
      sortOrder: number;
      active: boolean;
      paymentLinkUrl: string;
      syncStripe: boolean;
    }>,
  ) =>
    api<{ plan: PlanRow }>(`/plans/${id}`, { method: 'PUT', body }),
};
