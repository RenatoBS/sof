import { api } from '../api.js';
import { state, formatCurrency } from '../state.js';
import { escapeHtml } from '../utils.js';

export function renderServices() {
  const grid = document.getElementById('serviceGrid');
  grid.innerHTML = state.services
    .map(
      (svc) => `<div class="entity-card">
        <div class="row-top">
          <div>
            <h4>${escapeHtml(svc.name)}</h4>
            <div style="display:flex;gap:1rem;margin-top:.75rem;">
              <div><div class="meta">DURAÇÃO</div><div style="font-weight:600;margin-top:.25rem;">${svc.duration} min</div></div>
              <div><div class="meta">PREÇO</div><div style="font-weight:600;margin-top:.25rem;">${formatCurrency(svc.price)}</div></div>
            </div>
          </div>
          <button class="btn btn-danger" data-delete-service="${svc.id}">Excluir</button>
        </div>
      </div>`
    )
    .join('');

  grid.querySelectorAll('[data-delete-service]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este serviço?')) return;
      const id = btn.dataset.deleteService;
      await api(`/services/${id}`, { method: 'DELETE' });
      state.services = state.services.filter((s) => s.id !== id);
      renderServices();
    });
  });
}

export function initServices() {
  const formCard = document.getElementById('serviceFormCard');
  const toggleBtn = document.getElementById('toggleServiceFormBtn');
  const cancelBtn = document.getElementById('cancelServiceFormBtn');
  const form = document.getElementById('serviceForm');

  toggleBtn.addEventListener('click', () => formCard.classList.toggle('hidden'));
  cancelBtn.addEventListener('click', () => { formCard.classList.add('hidden'); form.reset(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { service } = await api('/services', {
        method: 'POST',
        body: {
          name: document.getElementById('svcName').value.trim(),
          duration: document.getElementById('svcDuration').value,
          price: document.getElementById('svcPrice').value,
        },
      });
      state.services.push(service);
      form.reset();
      formCard.classList.add('hidden');
      renderServices();
    } catch (err) {
      alert(err.message);
    }
  });
}
