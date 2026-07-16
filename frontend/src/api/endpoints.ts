import { api } from '@/src/api/client';
import type {
  Account,
  Appointment,
  Employee,
  EmployeeSession,
  OpeningHours,
  Service,
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
};

export const employeeApi = {
  appointments: () =>
    api<{ appointments: Appointment[] }>('/employee/appointments', {
      auth: 'employee',
    }),
  cancelAppointment: (id: string) =>
    api<{ appointment: Appointment }>(`/employee/appointments/${id}/cancel`, {
      method: 'POST',
      auth: 'employee',
    }),
};

export const checkoutApi = {
  create: (planName: string, name: string, email: string) =>
    api<{
      mode: 'redirect' | 'dev-approved';
      sessionId: string;
      initPoint?: string;
      token?: string;
    }>('/checkout/create', {
      method: 'POST',
      body: { planName, name, email },
      auth: false,
    }),
  status: (sessionId: string) =>
    api<{
      status: string;
      email?: string;
      tempPassword?: string;
      delivered?: boolean;
    }>(`/checkout/status/${sessionId}`, { auth: false }),
};

export const dashboardApi = {
  employees: () => api<{ employees: Employee[] }>('/employees'),
  createEmployee: (body: {
    name: string;
    email: string;
    serviceIds: string[];
  }) =>
    api<{ employee: Employee; temporaryPassword: string }>('/employees', {
      method: 'POST',
      body,
    }),
  updateEmployee: (
    id: string,
    body: {
      name: string;
      email: string;
      serviceIds: string[];
      resetPassword?: boolean;
    },
  ) =>
    api<{ employee: Employee; temporaryPassword?: string }>(
      `/employees/${id}`,
      {
        method: 'PUT',
        body,
      },
    ),
  deleteEmployee: (id: string) =>
    api<{ ok: boolean }>(`/employees/${id}`, { method: 'DELETE' }),
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
  appointments: () => api<{ appointments: Appointment[] }>('/appointments'),
  updateAppointment: (
    id: string,
    body: {
      clientName: string;
      clientPhone?: string;
      date: string;
      time: string;
      employeeId: string;
      serviceId: string;
    },
  ) =>
    api<{ appointment: Appointment }>(`/appointments/${id}`, {
      method: 'PUT',
      body,
    }),
  deleteAppointment: (id: string) =>
    api<{ ok: boolean }>(`/appointments/${id}`, { method: 'DELETE' }),
  integrations: () =>
    api<{
      stripe: { configured: boolean };
      whatsapp: { configured: boolean; linkedPhoneNumberId: string };
    }>('/account/integrations'),
  updateAccount: (body: {
    whatsappPhoneNumberId?: string;
    openingHours?: OpeningHours;
  }) => api<{ account: Account }>('/account', { method: 'PUT', body }),
  simulateWhatsapp: (message: string, customerPhone: string) =>
    api<{
      replies: string[];
      appointment?: Appointment;
    }>('/whatsapp/simulate', {
      method: 'POST',
      body: { message, customerPhone },
    }),
};
