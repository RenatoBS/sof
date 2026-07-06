import { api } from './api.js';
import { state, loadAll } from './state.js';
import { connectRealtime } from './realtime.js';
import { renderAgenda, initAgenda } from './views/agenda.js';
import { renderEmployees, initEmployees } from './views/employees.js';
import { renderServices, initServices } from './views/services.js';
import { renderBilling } from './views/billing.js';
import { renderAccount, initAccount } from './views/account.js';

function showToast(message) {
  const wrap = document.getElementById('toastWrap');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function renderAll() {
  renderAgenda();
  renderEmployees();
  renderServices();
  renderBilling();
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

async function bootstrap() {
  try {
    const { account } = await api('/auth/me');
    state.account = account;
  } catch {
    window.location.href = '/#login';
    return;
  }

  await loadAll();

  document.getElementById('gate').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('businessName').textContent = state.account.businessName;
  document.getElementById('accountEmail').textContent = state.account.email;

  initTabs();
  initAgenda();
  initEmployees();
  initServices();
  initAccount();

  renderAll();
  renderAccount();

  connectRealtime({
    onCreated: (appointment) => {
      const idx = state.appointments.findIndex((a) => a.id === appointment.id);
      if (idx === -1) state.appointments.push(appointment);
      else state.appointments[idx] = appointment;
      renderAgenda();
      renderBilling();
      if (appointment.source === 'whatsapp') {
        showToast(`<strong>Novo agendamento pelo WhatsApp</strong><br>${appointment.clientName} — ${appointment.date.split('-').reverse().join('/')} às ${appointment.time}`);
      }
    },
    onUpdated: (appointment) => {
      const idx = state.appointments.findIndex((a) => a.id === appointment.id);
      if (idx !== -1) state.appointments[idx] = appointment;
      renderAgenda();
      renderBilling();
    },
    onDeleted: (appointmentId) => {
      state.appointments = state.appointments.filter((a) => a.id !== appointmentId);
      renderAgenda();
      renderBilling();
    },
  });

  window.addEventListener('soft:refresh', renderAll);
}

bootstrap();
