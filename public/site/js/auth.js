import { api } from './api.js';

function showError(el, message) {
  el.textContent = message;
  el.classList.toggle('visible', Boolean(message));
}

export function initAuth() {
  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(errorBox, '');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await api('/auth/login', { method: 'POST', body: { email, password } });
      window.location.href = '/dashboard/';
    } catch (err) {
      showError(errorBox, err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
