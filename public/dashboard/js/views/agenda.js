import { api } from '../api.js';
import { state, getService, getEmployee } from '../state.js';
import { escapeHtml } from '../utils.js';
import { openAppointmentModal, setOnChange } from './appointmentModal.js';

const DOW = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

let selectedWeek = 0;

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getWeekDates(offset) {
  const today = new Date();
  const first = today.getDate() - today.getDay() + offset * 7;
  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    dates.push(new Date(today.getFullYear(), today.getMonth(), first + i));
  }
  return dates;
}

function appointmentsFor(employeeId, dateStr) {
  return state.appointments
    .filter((a) => a.employeeId === employeeId && a.date === dateStr)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function renderAgenda() {
  const weekDates = getWeekDates(selectedWeek);
  const todayStr = localDateStr(new Date());
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  document.getElementById('weekRangeLabel').textContent =
    `${weekStart.toLocaleDateString('pt-BR')} a ${weekEnd.toLocaleDateString('pt-BR')} — clique em qualquer agendamento para editar`;

  const emptyState = document.getElementById('agendaEmptyState');
  const wrap = document.getElementById('weekScheduleWrap');

  if (state.employees.length === 0) {
    emptyState.classList.remove('hidden');
    wrap.innerHTML = '';
    return;
  }
  emptyState.classList.add('hidden');

  const dayHeaders = weekDates
    .map((d) => {
      const isToday = localDateStr(d) === todayStr;
      return `<div class="week-schedule-day-header${isToday ? ' today' : ''}">
        <div class="dow">${DOW[d.getDay()].slice(0, 3)}</div>
        <div class="dom">${d.getDate()}</div>
      </div>`;
    })
    .join('');

  const employeeRows = state.employees
    .map((employee) => {
      const employeeCell = `<div class="week-schedule-employee" style="border-left-color:${employee.color}">
        <div>${escapeHtml(employee.name)}</div>
        <div class="specialty">${escapeHtml(employee.specialty)}</div>
      </div>`;

      const dayCells = weekDates
        .map((d) => {
          const dateStr = localDateStr(d);
          const appts = appointmentsFor(employee.id, dateStr);
          const blocks = appts
            .map((appt) => {
              const service = getService(appt.serviceId);
              const isWhatsapp = appt.source === 'whatsapp';
              return `<div class="appointment-block${isWhatsapp ? ' whatsapp' : ''}" data-appointment-id="${appt.id}" style="border-left-color:${employee.color}">
                <div class="appointment-time">${appt.time}</div>
                <div class="appointment-client">${escapeHtml(appt.clientName)}</div>
                <div class="appointment-service">${escapeHtml(service?.name || 'Serviço')}</div>
                <div class="appointment-price">R$ ${appt.price.toFixed(2).replace('.', ',')}</div>
                ${isWhatsapp ? '<div class="wa-badge">via WhatsApp</div>' : ''}
              </div>`;
            })
            .join('');
          return `<div class="week-schedule-cell" style="border-left-color:${employee.color}">${blocks}</div>`;
        })
        .join('');

      return employeeCell + dayCells;
    })
    .join('');

  wrap.innerHTML = `<div class="week-schedule">
    <div class="week-schedule-header">Profissional</div>
    ${dayHeaders}
    ${employeeRows}
  </div>`;

  wrap.querySelectorAll('[data-appointment-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const appt = state.appointments.find((a) => a.id === el.dataset.appointmentId);
      if (appt) openAppointmentModal(appt);
    });
  });
}

export function initAgenda() {
  document.getElementById('prevWeekBtn').addEventListener('click', () => { selectedWeek -= 1; renderAgenda(); });
  document.getElementById('nextWeekBtn').addEventListener('click', () => { selectedWeek += 1; renderAgenda(); });
  document.getElementById('todayBtn').addEventListener('click', () => { selectedWeek = 0; renderAgenda(); });
  setOnChange(renderAgenda);
  initWhatsappSimulator();
}

function addBubble(text, direction) {
  const log = document.getElementById('waLog');
  const bubble = document.createElement('div');
  bubble.className = `bubble ${direction}`;
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

function initWhatsappSimulator() {
  const form = document.getElementById('waForm');
  const messageInput = document.getElementById('waMessage');
  const phoneInput = document.getElementById('waPhone');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;
    addBubble(message, 'out');
    messageInput.value = '';
    try {
      const data = await api('/whatsapp/simulate', {
        method: 'POST',
        body: { message, customerPhone: phoneInput.value.trim() || '5511999990000' },
      });
      data.replies.forEach((reply) => addBubble(reply, 'in'));
      if (data.appointment) renderAgenda();
    } catch (err) {
      addBubble(`Erro: ${err.message}`, 'in');
    }
  });
}

export async function refreshWhatsappStatusBadges() {
  try {
    const data = await api('/account/integrations');
    document.querySelectorAll('#waStatus, #waStatusAccount').forEach((el) => {
      el.textContent = data.whatsapp.configured ? 'bot ativo' : 'bot não configurado';
      el.classList.toggle('on', data.whatsapp.configured);
      el.classList.toggle('off', !data.whatsapp.configured);
    });
    const mpStatus = document.getElementById('mpStatus');
    mpStatus.textContent = data.mercadoPago.configured ? 'conectado' : 'modo demonstração (sem cobrança real)';
    mpStatus.classList.toggle('on', data.mercadoPago.configured);
    mpStatus.classList.toggle('off', !data.mercadoPago.configured);
    document.getElementById('waPhoneNumberId').value = data.whatsapp.linkedPhoneNumberId || '';
  } catch {
    // silencioso — não é crítico para o uso do painel
  }
}
