import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';

export function renderEmployees() {
  const grid = document.getElementById('employeeGrid');
  grid.innerHTML = state.employees
    .map(
      (emp) => `<div class="entity-card">
        <div class="row-top">
          <div>
            <h4>${escapeHtml(emp.name)}</h4>
            <div class="meta">${escapeHtml(emp.specialty)}</div>
            <div class="meta">${escapeHtml(emp.phone)}</div>
          </div>
          <button class="btn btn-danger" data-delete-employee="${emp.id}">Excluir</button>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;padding-top:1rem;border-top:1px solid var(--line);">
          <span class="color-dot" style="background:${emp.color}"></span>
          <span class="meta">Cor de identificação</span>
        </div>
      </div>`
    )
    .join('');

  grid.querySelectorAll('[data-delete-employee]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este profissional? Os agendamentos dele também serão removidos.')) return;
      await api(`/employees/${btn.dataset.deleteEmployee}`, { method: 'DELETE' });
      const id = btn.dataset.deleteEmployee;
      state.employees = state.employees.filter((e) => e.id !== id);
      state.appointments = state.appointments.filter((a) => a.employeeId !== id);
      window.dispatchEvent(new CustomEvent('soft:refresh'));
    });
  });
}

export function initEmployees() {
  const formCard = document.getElementById('employeeFormCard');
  const toggleBtn = document.getElementById('toggleEmployeeFormBtn');
  const cancelBtn = document.getElementById('cancelEmployeeFormBtn');
  const form = document.getElementById('employeeForm');

  toggleBtn.addEventListener('click', () => formCard.classList.toggle('hidden'));
  cancelBtn.addEventListener('click', () => { formCard.classList.add('hidden'); form.reset(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { employee } = await api('/employees', {
        method: 'POST',
        body: {
          name: document.getElementById('empName').value.trim(),
          specialty: document.getElementById('empSpecialty').value.trim(),
          phone: document.getElementById('empPhone').value.trim(),
        },
      });
      state.employees.push(employee);
      form.reset();
      formCard.classList.add('hidden');
      renderEmployees();
      window.dispatchEvent(new CustomEvent('soft:refresh'));
    } catch (err) {
      alert(err.message);
    }
  });
}
