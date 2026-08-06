import { api } from '@/src/api/client';
import type {
  Account,
  Appointment,
  AppointmentWriteBody,
  Client,
  Employee,
  EmployeeSession,
  OpeningHours,
  Order,
  Product,
  Service,
  SupportTicket,
  SupportTicketComment,
  SupportTicketStatus,
  WhatsappHandoff,
  WhatsappMessage,
} from '@/src/api/types';

export const authApi = {
  login: (email: string, password: string) =>
    api<{ account: Account; token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  me: () => api<{ account: Account }>('/auth/me'),
  logout: () => api<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    api<{ ok: boolean; message: string }>('/auth/request-password-reset', {
      method: 'POST',
      body: { email },
      auth: false,
    }),
  passwordSetupInfo: (token: string) =>
    api<{
      email: string;
      name: string;
      businessName: string;
      expiresAt: string;
    }>(`/auth/password-setup?token=${encodeURIComponent(token)}`, {
      auth: false,
    }),
  passwordSetup: (token: string, password: string) =>
    api<{ account: Account; token: string }>('/auth/password-setup', {
      method: 'POST',
      body: { token, password },
      auth: false,
    }),
};

export const employeeAuthApi = {
  login: (email: string, password: string) =>
    api<{ employee: EmployeeSession; token: string }>('/employee-auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  me: () =>
    api<{ employee: EmployeeSession }>('/employee-auth/me', {
      auth: 'employee',
    }),
  logout: () =>
    api<{ ok: boolean }>('/employee-auth/logout', {
      method: 'POST',
      auth: 'employee',
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ employee: EmployeeSession }>('/employee-auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
      auth: 'employee',
    }),
  passwordSetupInfo: (token: string) =>
    api<{
      email: string;
      name: string;
      businessName: string;
      expiresAt: string;
    }>(`/employee-auth/password-setup?token=${encodeURIComponent(token)}`, {
      auth: false,
    }),
  passwordSetup: (token: string, password: string) =>
    api<{ employee: EmployeeSession; token: string }>(
      '/employee-auth/password-setup',
      {
        method: 'POST',
        body: { token, password },
        auth: false,
      },
    ),
  requestPasswordReset: (email: string) =>
    api<{ ok: boolean; message: string }>(
      '/employee-auth/request-password-reset',
      {
        method: 'POST',
        body: { email },
        auth: false,
      },
    ),
};

export const employeeApi = {
  appointments: () =>
    api<{ appointments: Appointment[] }>('/employee/appointments', {
      auth: 'employee',
    }),
  createAppointment: (body: AppointmentWriteBody) =>
    api<{ appointment: Appointment; appointments: Appointment[] }>(
      '/employee/appointments',
      {
        method: 'POST',
        body,
        auth: 'employee',
      },
    ),
  cancelAppointment: (id: string) =>
    api<{ appointment: Appointment }>(`/employee/appointments/${id}/cancel`, {
      method: 'POST',
      auth: 'employee',
    }),
  completeAppointment: (id: string) =>
    api<{ appointment: Appointment }>(
      `/employee/appointments/${id}/complete`,
      {
        method: 'POST',
        auth: 'employee',
      },
    ),
  clients: () =>
    api<{ clients: Client[] }>('/employee/clients', { auth: 'employee' }),
  createClient: (body: { name: string; phone: string }) =>
    api<{ client: Client }>('/employee/clients', {
      method: 'POST',
      body,
      auth: 'employee',
    }),
  services: () =>
    api<{ services: Service[] }>('/employee/services', { auth: 'employee' }),
  whatsappHandoffs: (status?: 'open' | 'resolved') =>
    api<{ handoffs: WhatsappHandoff[] }>(
      `/employee/whatsapp-handoffs${status ? `?status=${status}` : ''}`,
      { auth: 'employee' },
    ),
  whatsappHandoffMessages: (id: string) =>
    api<{ messages: WhatsappMessage[] }>(
      `/employee/whatsapp-handoffs/${id}/messages`,
      { auth: 'employee' },
    ),
  replyWhatsappHandoff: (id: string, text: string) =>
    api<{ handoff: WhatsappHandoff | null; message: WhatsappMessage | null }>(
      `/employee/whatsapp-handoffs/${id}/reply`,
      { method: 'POST', body: { text }, auth: 'employee' },
    ),
  claimWhatsappHandoff: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(
      `/employee/whatsapp-handoffs/${id}/claim`,
      { method: 'POST', auth: 'employee' },
    ),
  transferWhatsappHandoff: (
    id: string,
    body: { assigneeType: 'account' | 'employee'; employeeId?: string },
  ) =>
    api<{ handoff: WhatsappHandoff }>(
      `/employee/whatsapp-handoffs/${id}/transfer`,
      { method: 'POST', body, auth: 'employee' },
    ),
  releaseWhatsappHandoff: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(
      `/employee/whatsapp-handoffs/${id}/release`,
      { method: 'POST', auth: 'employee' },
    ),
  resolveWhatsappHandoff: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(
      `/employee/whatsapp-handoffs/${id}/resolve`,
      { method: 'POST', auth: 'employee' },
    ),
  returnWhatsappHandoffToSof: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(
      `/employee/whatsapp-handoffs/${id}/return-to-sof`,
      { method: 'POST', auth: 'employee' },
    ),
};

export const checkoutApi = {
  create: (
    planName: string,
    name: string,
    email: string,
    phone: string,
    password: string,
    couponCode?: string,
  ) =>
    api<{
      mode: 'redirect' | 'dev-approved' | 'promo-approved';
      sessionId: string;
      initPoint?: string;
      token?: string;
      promoExpiresAt?: string | null;
      freeDays?: number;
      planName?: string;
    }>('/checkout/create', {
      method: 'POST',
      body: {
        planName,
        name,
        email,
        phone,
        password,
        ...(couponCode ? { couponCode } : {}),
      },
      auth: false,
    }),
  status: (sessionId: string) =>
    api<{
      status: string;
      email?: string;
      token?: string;
      delivered?: boolean;
    }>(`/checkout/status/${sessionId}`, { auth: false }),
};

export const billingApi = {
  redeemCoupon: (couponCode: string) =>
    api<{
      account: Account;
      promoExpiresAt: string | null;
    }>('/billing/redeem-coupon', {
      method: 'POST',
      body: { couponCode },
    }),
  checkout: (planName: string) =>
    api<{
      mode: 'redirect' | 'dev-approved';
      sessionId: string;
      initPoint?: string;
      token?: string;
      account?: Account;
    }>('/billing/checkout', {
      method: 'POST',
      body: { planName },
    }),
};

export const plansApi = {
  list: () =>
    api<{
      plans: { name: string; price: number; features: string[] }[];
    }>('/plans', { auth: false }),
};

export const dashboardApi = {
  employees: () => api<{ employees: Employee[] }>('/employees'),
  createEmployee: (body: {
    name: string;
    email: string;
    phone: string;
    serviceIds: string[];
    color?: string;
    canHandleHandoffs?: boolean;
  }) =>
    api<{
      employee: Employee;
      resetLink: string;
      expiresAt: string;
    }>('/employees', {
      method: 'POST',
      body,
    }),
  updateEmployee: (
    id: string,
    body: {
      name: string;
      email: string;
      phone: string;
      serviceIds: string[];
      color?: string;
      canHandleHandoffs?: boolean;
      resetPassword?: boolean;
    },
  ) =>
    api<{
      employee: Employee;
      resetLink?: string;
      expiresAt?: string;
    }>(`/employees/${id}`, {
      method: 'PUT',
      body,
    }),
  deleteEmployee: (id: string) =>
    api<{ ok: boolean }>(`/employees/${id}`, { method: 'DELETE' }),
  sendEmployeePasswordLink: (id: string) =>
    api<{
      ok: boolean;
      sent: boolean;
      resetLink: string;
      expiresAt: string;
    }>(`/employees/${id}/send-password-link`, { method: 'POST' }),
  services: () => api<{ services: Service[] }>('/services'),
  createService: (body: { name: string; duration: number; price: number }) =>
    api<{ service: Service }>('/services', { method: 'POST', body }),
  updateService: (
    id: string,
    body: { name: string; duration: number; price: number },
  ) =>
    api<{ service: Service }>(`/services/${id}`, { method: 'PUT', body }),
  deleteService: (id: string) =>
    api<{ ok: boolean }>(`/services/${id}`, { method: 'DELETE' }),
  products: () => api<{ products: Product[] }>('/products'),
  createProduct: (body: {
    name: string;
    description?: string;
    price: number;
    images?: string[];
    stock?: number | null;
    paymentLinkUrl?: string;
    handoffEnabled?: boolean;
    active?: boolean;
  }) => api<{ product: Product }>('/products', { method: 'POST', body }),
  updateProduct: (
    id: string,
    body: {
      name: string;
      description?: string;
      price: number;
      images?: string[];
      stock?: number | null;
      paymentLinkUrl?: string;
      handoffEnabled?: boolean;
      active?: boolean;
    },
  ) =>
    api<{ product: Product }>(`/products/${id}`, { method: 'PUT', body }),
  deleteProduct: (id: string) =>
    api<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' }),
  orders: (status?: string) =>
    api<{ orders: Order[] }>(
      status ? `/orders?status=${encodeURIComponent(status)}` : '/orders',
    ),
  updateOrderStatus: (
    id: string,
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
  ) =>
    api<{ order: Order }>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
  clients: () => api<{ clients: Client[] }>('/clients'),
  createClient: (body: { name: string; phone: string }) =>
    api<{ client: Client }>('/clients', { method: 'POST', body }),
  updateClient: (
    id: string,
    body: {
      name: string;
      phone: string;
      botPausedPermanent?: boolean;
      botPausedUntil?: string | null;
    },
  ) =>
    api<{ client: Client }>(`/clients/${id}`, { method: 'PUT', body }),
  deleteClient: (id: string) =>
    api<{ ok: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
  appointments: () => api<{ appointments: Appointment[] }>('/appointments'),
  createAppointment: (body: AppointmentWriteBody) =>
    api<{ appointment: Appointment; appointments: Appointment[] }>(
      '/appointments',
      {
        method: 'POST',
        body,
      },
    ),
  updateAppointment: (id: string, body: AppointmentWriteBody) =>
    api<{ appointment: Appointment }>(`/appointments/${id}`, {
      method: 'PUT',
      body,
    }),
  deleteAppointment: (id: string, scope?: 'one' | 'series') =>
    api<{ ok: boolean; deletedCount?: number }>(
      `/appointments/${id}${scope === 'series' ? '?scope=series' : ''}`,
      { method: 'DELETE' },
    ),
  completeAppointment: (id: string) =>
    api<{ appointment: Appointment }>(`/appointments/${id}/complete`, {
      method: 'POST',
    }),
  integrations: () =>
    api<{
      stripe: { configured: boolean };
      whatsapp: {
        configured: boolean;
        provider?: string;
        linkedPhoneNumberId: string;
        linked?: boolean;
        hasInstance?: boolean;
        pairingAvailable?: boolean;
      };
    }>('/account/integrations'),
  updateAccount: (body: {
    whatsappPhoneNumberId?: string;
    openingHours?: OpeningHours;
    address?: string;
    phone?: string;
    businessName?: string;
    whatsappReminderMinutes?: number;
    timezone?: string;
    botPausedPermanent?: boolean;
    botPausedUntil?: string | null;
    botAttendsServices?: boolean;
    botAttendsProducts?: boolean;
    botMenuOfferHuman?: boolean;
    botMenuShowAddress?: boolean;
    botMenuShowHours?: boolean;
    logoBase64?: string | null;
  }) => api<{ account: Account }>('/account', { method: 'PUT', body }),
  connectWhatsapp: (body?: { phone?: string }) =>
    api<{
      status: string;
      instanceId: string;
      qrcode?: string;
      paircode?: string | null;
      mode: 'qrcode' | 'paircode';
    }>('/account/whatsapp/connect', {
      method: 'POST',
      body: body || {},
    }),
  whatsappStatus: () =>
    api<{
      status: string;
      linked: boolean;
      instanceId: string;
      phone: string | null;
      qrcode: string | null;
      paircode: string | null;
      connectedAt: string | null;
    }>('/account/whatsapp/status'),
  disconnectWhatsapp: () =>
    api<{ ok: boolean; status: string }>('/account/whatsapp/disconnect', {
      method: 'POST',
    }),
  whatsappHandoffs: (status?: 'open' | 'resolved') =>
    api<{ handoffs: WhatsappHandoff[] }>(
      `/whatsapp-handoffs${status ? `?status=${status}` : ''}`,
    ),
  whatsappHandoffSettings: () =>
    api<{ threshold: number; allowed: number[] }>(
      '/whatsapp-handoffs/settings',
    ),
  updateWhatsappHandoffSettings: (threshold: number) =>
    api<{ threshold: number; allowed: number[] }>(
      '/whatsapp-handoffs/settings',
      { method: 'PUT', body: { threshold } },
    ),
  resolveWhatsappHandoff: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(`/whatsapp-handoffs/${id}/resolve`, {
      method: 'POST',
    }),
  whatsappHandoffMessages: (id: string) =>
    api<{ messages: WhatsappMessage[] }>(`/whatsapp-handoffs/${id}/messages`),
  replyWhatsappHandoff: (id: string, text: string) =>
    api<{ handoff: WhatsappHandoff | null; message: WhatsappMessage | null }>(
      `/whatsapp-handoffs/${id}/reply`,
      { method: 'POST', body: { text } },
    ),
  claimWhatsappHandoff: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(`/whatsapp-handoffs/${id}/claim`, {
      method: 'POST',
    }),
  transferWhatsappHandoff: (
    id: string,
    body: { assigneeType: 'account' | 'employee'; employeeId?: string },
  ) =>
    api<{ handoff: WhatsappHandoff }>(`/whatsapp-handoffs/${id}/transfer`, {
      method: 'POST',
      body,
    }),
  releaseWhatsappHandoff: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(`/whatsapp-handoffs/${id}/release`, {
      method: 'POST',
    }),
  returnWhatsappHandoffToSof: (id: string) =>
    api<{ handoff: WhatsappHandoff }>(`/whatsapp-handoffs/${id}/return-to-sof`, {
      method: 'POST',
    }),
  simulateWhatsapp: (message: string, customerPhone: string) =>
    api<{
      replies: string[];
      appointment?: Appointment;
    }>('/whatsapp/simulate', {
      method: 'POST',
      body: { message, customerPhone },
    }),
  tickets: (status?: SupportTicketStatus) =>
    api<{ tickets: SupportTicket[] }>(
      `/tickets${status ? `?status=${status}` : ''}`,
    ),
  ticket: (id: string) => api<{ ticket: SupportTicket }>(`/tickets/${id}`),
  createTicket: (body: { title: string; description: string }) =>
    api<{ ticket: SupportTicket }>('/tickets', { method: 'POST', body }),
  commentTicket: (id: string, body: string) =>
    api<{ comment: SupportTicketComment }>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: { body },
    }),
  updateTicketStatus: (id: string, status: SupportTicketStatus) =>
    api<{ ticket: SupportTicket }>(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
};

export const employeeTicketsApi = {
  list: (status?: SupportTicketStatus) =>
    api<{ tickets: SupportTicket[] }>(
      `/tickets${status ? `?status=${status}` : ''}`,
      { auth: 'employee' },
    ),
  get: (id: string) =>
    api<{ ticket: SupportTicket }>(`/tickets/${id}`, { auth: 'employee' }),
  create: (body: { title: string; description: string }) =>
    api<{ ticket: SupportTicket }>('/tickets', {
      method: 'POST',
      body,
      auth: 'employee',
    }),
  comment: (id: string, body: string) =>
    api<{ comment: SupportTicketComment }>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: { body },
      auth: 'employee',
    }),
  updateStatus: (id: string, status: SupportTicketStatus) =>
    api<{ ticket: SupportTicket }>(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: { status },
      auth: 'employee',
    }),
};
