import { state, getEmployee, getService, formatCurrency } from '../state.js';
import { escapeHtml } from '../utils.js';
import { openAppointmentModal } from './appointmentModal.js';

function isSameDay(dateStr, ref) {
  return dateStr === ref;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function revenueFor(filter) {
  const confirmed = state.appointments.filter((a) => a.status === 'confirmed');
  const today = new Date();
  const todayStr = localDateStr(today);

  let filtered = confirmed;
  if (filter === 'day') {
    filtered = confirmed.filter((a) => isSameDay(a.date, todayStr));
  } else if (filter === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    filtered = confirmed.filter((a) => {
      const d = new Date(`${a.date}T00:00:00`);
      return d >= weekStart && d <= weekEnd;
    });
  } else if (filter === 'month') {
    filtered = confirmed.filter((a) => {
      const d = new Date(`${a.date}T00:00:00`);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
  }
  return filtered.reduce((sum, a) => sum + (a.price || 0), 0);
}

export function renderBilling() {
  document.getElementById('revenueDay').textContent = formatCurrency(revenueFor('day'));
  document.getElementById('revenueWeek').textContent = formatCurrency(revenueFor('week'));
  document.getElementById('revenueMonth').textContent = formatCurrency(revenueFor('month'));

  const body = document.getElementById('billingTableBody');
  const confirmed = state.appointments
    .filter((a) => a.status === 'confirmed')
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  if (confirmed.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem 1rem;color:var(--muted);">Nenhum agendamento confirmado</td></tr>`;
    return;
  }

  body.innerHTML = confirmed
    .map((appt) => {
      const employee = getEmployee(appt.employeeId);
      const service = getService(appt.serviceId);
      const [y, m, d] = appt.date.split('-');
      return `<tr data-appointment-id="${appt.id}">
        <td>${d}/${m}/${y}</td>
        <td>${appt.time}</td>
        <td>${escapeHtml(appt.clientName)}</td>
        <td>${escapeHtml(service?.name || '—')}</td>
        <td>${escapeHtml(employee?.name || 'Sem atribuição')}</td>
        <td>${appt.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}</td>
        <td class="right">${formatCurrency(appt.price)}</td>
      </tr>`;
    })
    .join('');

  body.querySelectorAll('[data-appointment-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const appt = state.appointments.find((a) => a.id === row.dataset.appointmentId);
      if (appt) openAppointmentModal(appt);
    });
  });
}
