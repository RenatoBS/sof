#!/usr/bin/env node
import { api, apiRaw, assert, loginAccount, log } from './lib.mjs';

async function main() {
  const { token } = await loginAccount();
  const stamp = Date.now();

  const created = await api('/tickets', {
    method: 'POST',
    token,
    body: {
      title: `E2E Ticket ${stamp}`,
      description: 'Criado pelo script support-api',
    },
  });
  const ticket = created.ticket;
  assert(ticket?.id, 'ticket create');
  log('create', ticket.id);

  await api(`/tickets/${ticket.id}/comments`, {
    method: 'POST',
    token,
    body: { body: 'Comentário e2e' },
  });

  const mid = await api(`/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'in_progress' },
  });
  assert(
    mid.ticket?.status === 'in_progress' || mid.status === 'in_progress',
    'in_progress',
  );

  await api(`/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'resolved' },
  });

  const reopen = await apiRaw(`/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'open' },
  });
  assert(reopen.status === 403, `esperava 403 ao reabrir, veio ${reopen.status}`);
  log('OK', 'support-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
