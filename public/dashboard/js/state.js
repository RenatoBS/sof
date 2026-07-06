import { api } from './api.js';

export const state = {
  account: null,
  employees: [],
  services: [],
  appointments: [],
};

export async function loadAll() {
  const [employeesRes, servicesRes, appointmentsRes] = await Promise.all([
    api('/employees'),
    api('/services'),
    api('/appointments'),
  ]);
  state.employees = employeesRes.employees;
  state.services = servicesRes.services;
  state.appointments = appointmentsRes.appointments;
}

export function getService(id) {
  return state.services.find((s) => s.id === id);
}

export function getEmployee(id) {
  return state.employees.find((e) => e.id === id);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}
