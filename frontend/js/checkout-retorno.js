import { api } from './api.js';

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('ref');

const waiting = document.getElementById('waiting');
const approved = document.getElementById('approved');
const failed = document.getElementById('failed');
const title = document.getElementById('title');
const subtitle = document.getElementById('subtitle');

function showFailed() {
  waiting.style.display = 'none';
  approved.style.display = 'none';
  failed.style.display = '';
  title.textContent = 'Não foi possível confirmar';
  subtitle.textContent = '';
}

if (!sessionId) {
  showFailed();
} else {
  const timer = setInterval(async () => {
    try {
      const data = await api(`/checkout/status/${sessionId}`);
      if (data.status === 'approved') {
        clearInterval(timer);
        waiting.style.display = 'none';
        approved.style.display = '';
        title.textContent = 'Pagamento aprovado';
        subtitle.textContent = 'Sua assinatura Soft está ativa.';
        document.getElementById('credEmail').textContent = data.email;
        document.getElementById('credPassword').textContent = data.tempPassword || '(recuperada anteriormente — faça login normalmente)';
      } else if (data.status === 'rejected') {
        clearInterval(timer);
        showFailed();
      }
    } catch {
      clearInterval(timer);
      showFailed();
    }
  }, 2000);

  // Evita ficar preso em polling eterno se o webhook nunca chegar.
  setTimeout(() => clearInterval(timer), 2 * 60 * 1000);
}
