import { api } from '../api.js';
import { state } from '../state.js';
import { refreshWhatsappStatusBadges } from './agenda.js';

export function renderAccount() {
  document.getElementById('accPlan').textContent = state.account.plan;
  document.getElementById('accEmail').textContent = state.account.email;
  document.getElementById('accDate').textContent = new Date(state.account.createdAt).toLocaleDateString('pt-BR');
  refreshWhatsappStatusBadges();
}

async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/';
}

export function initAccount() {
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('logoutBtn2').addEventListener('click', logout);

  document.getElementById('waPhoneForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = document.getElementById('waPhoneNumberId').value.trim();
    try {
      const { account } = await api('/account', { method: 'PUT', body: { whatsappPhoneNumberId: value } });
      state.account = account;
      alert('Número de WhatsApp vinculado a este painel.');
    } catch (err) {
      alert(err.message);
    }
  });
}
