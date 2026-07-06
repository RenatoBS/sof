// Hub simples de Server-Sent Events: mantém uma lista de respostas HTTP abertas por conta
// e transmite eventos (ex.: "agendamento confirmado pelo WhatsApp") em tempo real para o dashboard.
const clientsByAccount = new Map();

function subscribe(accountId, res) {
  if (!clientsByAccount.has(accountId)) clientsByAccount.set(accountId, new Set());
  clientsByAccount.get(accountId).add(res);
}

function unsubscribe(accountId, res) {
  const set = clientsByAccount.get(accountId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientsByAccount.delete(accountId);
}

function broadcast(accountId, event, payload) {
  const set = clientsByAccount.get(accountId);
  if (!set || set.size === 0) return;
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    res.write(chunk);
  }
}

module.exports = { subscribe, unsubscribe, broadcast };
