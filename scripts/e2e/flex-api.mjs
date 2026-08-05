#!/usr/bin/env node
/**
 * Flex gaps: release, settings, employee portal, product_sale / unresolved.
 * O fluxo claim/reply/transfer/return-to-sof permanece em handoff-inbox-api.mjs.
 */
import {
  api,
  assert,
  demoCredentials,
  ensureEmployeePassword,
  loginAccount,
  log,
  pause,
  simulate,
  uniquePhone,
} from './lib.mjs';

async function openHandoff(token, phone, name = 'Flex Gap E2E') {
  for (const msg of ['oi', name, 'quero falar com um atendente']) {
    const res = await simulate(token, phone, msg);
    log(
      'sim',
      `"${msg}" handoff=${Boolean(res.handoffOpened)} silenced=${Boolean(res.silenced)}`,
    );
    await pause(200);
  }
  const { handoffs } = await api('/whatsapp-handoffs?status=open', { token });
  const h = (handoffs || []).find((x) => x.customerPhone === phone);
  assert(h, `handoff não listado para ${phone}`);
  return h;
}

async function main() {
  const { token } = await loginAccount();
  const { password } = demoCredentials();

  // Settings
  const settings = await api('/whatsapp-handoffs/settings', { token });
  assert(settings.threshold >= 1, 'threshold');
  const next =
    settings.allowed.find((n) => n !== settings.threshold) || settings.threshold;
  await api('/whatsapp-handoffs/settings', {
    method: 'PUT',
    token,
    body: { threshold: next },
  });
  await api('/whatsapp-handoffs/settings', {
    method: 'PUT',
    token,
    body: { threshold: settings.threshold },
  });
  log('settings', `threshold ${settings.threshold}`);

  // Release
  const phone = uniquePhone('55114');
  const h = await openHandoff(token, phone, 'Release E2E');
  await api(`/whatsapp-handoffs/${h.id}/claim`, { method: 'POST', token });
  const released = await api(`/whatsapp-handoffs/${h.id}/release`, {
    method: 'POST',
    token,
  });
  assert(!released.handoff.assigneeType, 'release não limpou assignee');
  await api(`/whatsapp-handoffs/${h.id}/resolve`, { method: 'POST', token });
  log('release', 'ok');

  // Employee portal
  const { employees } = await api('/employees', { token });
  const emp = employees[0];
  await api(`/employees/${emp.id}`, {
    method: 'PUT',
    token,
    body: {
      name: emp.name,
      email: emp.email,
      phone: String(emp.phone || '').replace(/\D/g, '') || '11988881111',
      serviceIds: (emp.services || []).map((s) => s.id),
      color: emp.color,
      canHandleHandoffs: true,
    },
  });
  const empSession = await ensureEmployeePassword(token, {
    ...emp,
    canHandleHandoffs: true,
  }, password);

  const phone2 = uniquePhone('55113');
  const h2 = await openHandoff(token, phone2, 'Portal Prof E2E');
  const listEmp = await api('/employee/whatsapp-handoffs?status=open', {
    token: empSession.token,
  });
  assert(
    (listEmp.handoffs || []).some((x) => x.id === h2.id),
    'prof não vê fila',
  );
  await api(`/employee/whatsapp-handoffs/${h2.id}/claim`, {
    method: 'POST',
    token: empSession.token,
  });
  await api(`/employee/whatsapp-handoffs/${h2.id}/reply`, {
    method: 'POST',
    token: empSession.token,
    body: { text: 'Oi, profissional no e2e.' },
  });
  await api(`/employee/whatsapp-handoffs/${h2.id}/resolve`, {
    method: 'POST',
    token: empSession.token,
  });
  log('employee-portal', 'claim/reply/resolve ok');

  // Unresolved threshold (N falhas) — força threshold 1
  await api('/whatsapp-handoffs/settings', {
    method: 'PUT',
    token,
    body: { threshold: 1 },
  });
  const phone3 = uniquePhone('55112');
  await simulate(token, phone3, 'oi');
  await simulate(token, phone3, 'Unresolved E2E');
  // mensagem sem sentido no menu
  let opened = false;
  for (let i = 0; i < 4; i++) {
    const r = await simulate(token, phone3, `xyzfalha${i}${Date.now()}`);
    if (r.handoffOpened) {
      opened = true;
      break;
    }
    await pause(100);
  }
  log('unresolved', opened ? 'abriu' : 'não abriu (bot pode ter interpretado)');
  await api('/whatsapp-handoffs/settings', {
    method: 'PUT',
    token,
    body: { threshold: settings.threshold },
  });

  // product_sale: produto com handoffEnabled
  await api('/account', {
    method: 'PUT',
    token,
    body: { botAttendsProducts: true },
  });
  const stamp = Date.now();
  const { product } = await api('/products', {
    method: 'POST',
    token,
    body: {
      name: `E2E Sale ${stamp}`,
      description: 'handoff',
      price: 10,
      handoffEnabled: true,
      active: true,
      images: [],
    },
  });
  const phone4 = uniquePhone('55111');
  let res = await simulate(token, phone4, 'oi');
  res = await simulate(token, phone4, 'Venda Handoff E2E');
  // tenta caminho produto
  for (const msg of ['2', 'produtos', 'quero comprar']) {
    res = await simulate(token, phone4, msg);
    if ((res.interactive || []).length) break;
  }
  log('product_sale', `handoffOpened=${Boolean(res.handoffOpened || res.productSaleHandoff)}`);
  await api(`/products/${product.id}`, { method: 'DELETE', token }).catch(
    () => undefined,
  );

  log('OK', 'flex-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
