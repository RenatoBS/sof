import { api } from './api.js';

function showError(el, message) {
  el.textContent = message;
  el.classList.toggle('visible', Boolean(message));
}

function formatBRL(value) {
  return value.toFixed(2).replace('.', ',');
}

export function initCheckout() {
  const modal = document.getElementById('checkoutModal');
  const stepForm = document.getElementById('checkoutStepForm');
  const stepSuccess = document.getElementById('checkoutStepSuccess');
  const summary = document.getElementById('checkoutSummary');
  const errorBox = document.getElementById('checkoutError');
  const form = document.getElementById('checkoutForm');
  const submitBtn = document.getElementById('checkoutSubmitBtn');

  let currentPlan = { name: '', price: 0 };
  let pollTimer = null;

  function openModal(planName, price) {
    currentPlan = { name: planName, price };
    stepForm.style.display = '';
    stepSuccess.style.display = 'none';
    showError(errorBox, '');
    form.reset();
    summary.innerHTML = `
      <div class="summary-row"><span>Plano ${planName}</span><span>R$ ${formatBRL(price)}</span></div>
      <div class="summary-row"><span style="color:var(--muted)">Cobrança mensal</span><span style="color:var(--muted)">renovação automática</span></div>
      <div class="summary-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">
        <span class="total">Total hoje</span><span class="total">R$ ${formatBRL(price)}</span>
      </div>`;
    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
    if (pollTimer) clearInterval(pollTimer);
  }

  document.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal(btn.dataset.plan, Number(btn.dataset.price));
    });
  });

  document.getElementById('checkoutCloseBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.getElementById('goToDashboardBtn').addEventListener('click', () => {
    window.location.href = '/dashboard/';
  });

  function pollStatus(sessionId) {
    pollTimer = setInterval(async () => {
      try {
        const data = await api(`/checkout/status/${sessionId}`);
        if (data.status === 'approved') {
          clearInterval(pollTimer);
          stepForm.style.display = 'none';
          stepSuccess.style.display = '';
          document.getElementById('credEmail').textContent = data.email;
          document.getElementById('credPassword').textContent = data.tempPassword || '(já entregue anteriormente)';
        }
      } catch {
        clearInterval(pollTimer);
      }
    }, 1500);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(errorBox, '');
    const name = document.getElementById('cName').value.trim();
    const email = document.getElementById('cEmail').value.trim();

    submitBtn.disabled = true;
    try {
      const data = await api('/checkout/create', {
        method: 'POST',
        body: { planName: currentPlan.name, name, email },
      });

      if (data.mode === 'redirect') {
        window.location.href = data.initPoint;
        return;
      }

      // Modo demonstração: o próprio /checkout/create já aprovou a conta.
      pollStatus(data.sessionId);
    } catch (err) {
      showError(errorBox, err.message);
      submitBtn.disabled = false;
    }
  });
}
