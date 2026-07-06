import { api } from '../api.js';
import { state } from '../state.js';

const overlay = document.getElementById('appointmentModal');
const form = document.getElementById('appointmentForm');
const clientInput = document.getElementById('modClient');
const dateInput = document.getElementById('modDate');
const timeInput = document.getElementById('modTime');
const serviceSelect = document.getElementById('modService');
const employeeSelect = document.getElementById('modEmployee');
const deleteBtn = document.getElementById('deleteAppointmentBtn');
const closeBtn = document.getElementById('closeAppointmentModalBtn');

let currentAppointment = null;
let onChange = () => {};

export function setOnChange(fn) {
  onChange = fn;
}

function fillSelects() {
  serviceSelect.innerHTML = state.services.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  employeeSelect.innerHTML = state.employees.map((e) => `<option value="${e.id}">${e.name}</option>`).join('');
}

export function openAppointmentModal(appointment) {
  currentAppointment = appointment;
  fillSelects();
  clientInput.value = appointment.clientName;
  dateInput.value = appointment.date;
  timeInput.value = appointment.time;
  serviceSelect.value = appointment.serviceId;
  employeeSelect.value = appointment.employeeId;
  overlay.classList.remove('hidden');
}

function closeModal() {
  overlay.classList.add('hidden');
  currentAppointment = null;
}

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentAppointment) return;
  try {
    const { appointment } = await api(`/appointments/${currentAppointment.id}`, {
      method: 'PUT',
      body: {
        clientName: clientInput.value.trim(),
        date: dateInput.value,
        time: timeInput.value,
        serviceId: serviceSelect.value,
        employeeId: employeeSelect.value,
      },
    });
    const idx = state.appointments.findIndex((a) => a.id === appointment.id);
    if (idx !== -1) state.appointments[idx] = appointment;
    closeModal();
    onChange();
  } catch (err) {
    alert(err.message);
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!currentAppointment) return;
  if (!confirm('Cancelar este agendamento?')) return;
  try {
    await api(`/appointments/${currentAppointment.id}`, { method: 'DELETE' });
    state.appointments = state.appointments.filter((a) => a.id !== currentAppointment.id);
    closeModal();
    onChange();
  } catch (err) {
    alert(err.message);
  }
});
