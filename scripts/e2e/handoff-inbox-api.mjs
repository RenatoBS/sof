#!/usr/bin/env node
/**
 * E2E API — inbox Flex de Atendimentos
 *
 * Pré-requisito: `npm run saas` (API :3001) + seed Equipe (`demo@sof.com`).
 *
 * Fluxo: login → simulate (pedir humano) → claim → reply → transfer
 * → release (conta) → return-to-sof.
 */
import { api, loginAccount, log, pause } from './lib.mjs';

async function simulate(token, phone, message) {
  return api('/whatsapp/simulate', {
    method: 'POST',
    token,
    body: { customerPhone: phone, message },
  });
}

async function main() {
  const phone = `55119${String(Date.now()).slice(-8)}`;
  log('setup', `phone=${phone}`);

  const { token, account } = await loginAccount();
  log('login', `${account.email} plan=${account.plan}`);

  const ents = account.entitlements || {};
  if (ents.handoffs === false) {
    throw new Error('Conta demo sem entitlement handoffs — use plano Equipe/Rede');
  }

  // Novo cliente: nome → menu → pedido de humano
  for (const msg of ['oi', 'Ana Flex E2E', 'quero falar com um atendente']) {
    const res = await simulate(token, phone, msg);
    log(
      'sim',
      `"${msg}" → replies=${(res.replies || []).length} handoff=${Boolean(res.handoffOpened)} silenced=${Boolean(res.silenced)}`,
    );
    await pause(200);
  }

  const list = await api('/whatsapp-handoffs?status=open', { token });
  const handoff = (list.handoffs || []).find((h) => h.customerPhone === phone);
  if (!handoff) {
    throw new Error('Handoff aberto não encontrado após pedido de atendente');
  }
  log('handoff', `id=${handoff.id} status=${handoff.status} assignee=${handoff.assigneeType || 'fila'}`);

  const beforeMsgs = await api(`/whatsapp-handoffs/${handoff.id}/messages`, {
    token,
  });
  log('messages', `thread inicial: ${beforeMsgs.messages.length}`);
  if (beforeMsgs.messages.length < 1) {
    throw new Error('Esperava ao menos a mensagem seed na thread');
  }

  const claimed = await api(`/whatsapp-handoffs/${handoff.id}/claim`, {
    method: 'POST',
    token,
  });
  if (claimed.handoff.assigneeType !== 'account') {
    throw new Error(`Claim falhou: ${claimed.handoff.assigneeType}`);
  }
  log('claim', 'assigneeType=account');

  const replied = await api(`/whatsapp-handoffs/${handoff.id}/reply`, {
    method: 'POST',
    token,
    body: { text: 'Oi Ana, aqui é a equipe Sof (e2e API).' },
  });
  if (!replied.message || replied.message.senderKind !== 'agent') {
    throw new Error('Reply não gravou mensagem agent');
  }
  log('reply', `message id=${replied.message.id}`);

  // Habilita um profissional e transfere
  const { employees } = await api('/employees', { token });
  const target = employees[0];
  if (!target) throw new Error('Seed sem profissionais');

  await api(`/employees/${target.id}`, {
    method: 'PUT',
    token,
    body: {
      name: target.name,
      email: target.email,
      phone: String(target.phone || '').replace(/\D/g, '') || '11987654321',
      serviceIds: (target.services || []).map((s) => s.id),
      color: target.color,
      canHandleHandoffs: true,
    },
  });
  log('employee', `${target.name} canHandleHandoffs=true`);

  const transferred = await api(`/whatsapp-handoffs/${handoff.id}/transfer`, {
    method: 'POST',
    token,
    body: { assigneeType: 'employee', employeeId: target.id },
  });
  if (
    transferred.handoff.assigneeType !== 'employee' ||
    transferred.handoff.assignedEmployeeId !== target.id
  ) {
    throw new Error('Transfer para profissional falhou');
  }
  log('transfer', `→ employee ${target.id}`);

  // Conta traz de volta e devolve à Sof
  const back = await api(`/whatsapp-handoffs/${handoff.id}/transfer`, {
    method: 'POST',
    token,
    body: { assigneeType: 'account' },
  });
  if (back.handoff.assigneeType !== 'account') {
    throw new Error('Transfer de volta para conta falhou');
  }
  log('transfer', '→ account');

  const done = await api(`/whatsapp-handoffs/${handoff.id}/return-to-sof`, {
    method: 'POST',
    token,
  });
  if (done.handoff.status !== 'resolved') {
    throw new Error('return-to-sof não resolveu');
  }
  log('return-to-sof', 'resolved');

  const afterMsgs = await api(`/whatsapp-handoffs/${handoff.id}/messages`, {
    token,
  });
  const hasAgent = afterMsgs.messages.some((m) => m.senderKind === 'agent');
  if (!hasAgent) throw new Error('Thread final sem mensagem agent');
  log('OK', `API e2e passou — ${afterMsgs.messages.length} msgs na thread`);
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exitCode = 1;
});
