#!/usr/bin/env node
import {
  api,
  assert,
  loginAccount,
  log,
  pause,
  simulate,
  uniquePhone,
} from './lib.mjs';

async function pickChoice(res, pred) {
  for (const menu of res.interactive || []) {
    for (const c of menu.choices || []) {
      if (pred(c)) return c.id;
    }
  }
  return null;
}

async function main() {
  const { token, account } = await loginAccount();
  // Garante bot atende serviços + produtos
  await api('/account', {
    method: 'PUT',
    token,
    body: { botAttendsServices: true, botAttendsProducts: true },
  });

  // --- Book path (melhor esforço via menus) ---
  const bookPhone = uniquePhone('55117');
  let res = await simulate(token, bookPhone, 'oi');
  res = await simulate(token, bookPhone, 'Lia Agenda E2E');
  log('book', `menu replies=${(res.replies || []).length} interactive=${(res.interactive || []).length}`);

  let intent =
    (await pickChoice(res, (c) => /agend|servi|marcar/i.test(c.title || c.id))) ||
    (await pickChoice(res, (c) => String(c.id).includes('book') || String(c.id).includes('service')));
  if (!intent && (res.interactive || [])[0]?.choices?.[0]) {
    intent = res.interactive[0].choices[0].id;
  }
  if (intent) {
    res = await simulate(token, bookPhone, intent);
    log('book', `escolheu ${intent}`);
    // Continua clicando primeira opção disponível por até 8 passos
    for (let i = 0; i < 8; i++) {
      const next =
        (await pickChoice(res, () => true)) ||
        null;
      if (!next) break;
      if (/confirm|sim|ok/i.test(next) || next === '1') {
        res = await simulate(token, bookPhone, next);
        break;
      }
      res = await simulate(token, bookPhone, next);
      await pause(150);
      if (res.appointment) break;
    }
  }
  log('book', `appointment=${Boolean(res.appointment)} handoff=${Boolean(res.handoffOpened)}`);

  // --- Product path ---
  const prodPhone = uniquePhone('55116');
  res = await simulate(token, prodPhone, 'oi');
  res = await simulate(token, prodPhone, 'Pedro Produto E2E');
  const prodIntent =
    (await pickChoice(res, (c) => /produt|comprar|loja/i.test(c.title || c.id))) ||
    (await pickChoice(res, (c) => /product/i.test(String(c.id))));
  if (prodIntent) {
    res = await simulate(token, prodPhone, prodIntent);
    for (let i = 0; i < 6; i++) {
      const next = await pickChoice(res, () => true);
      if (!next) {
        // quantidade / confirmação em texto
        res = await simulate(token, prodPhone, i === 0 ? '1' : '1');
      } else {
        res = await simulate(token, prodPhone, next);
      }
      await pause(150);
      if (res.order || res.productSaleHandoff) break;
    }
  }
  log('product', `order=${Boolean(res.order)} saleHandoff=${Boolean(res.productSaleHandoff)}`);

  // --- Cancel path (se houver agendamento futuro do seed) ---
  const { appointments } = await api('/appointments', { token });
  const future = (appointments || []).find(
    (a) => a.status === 'scheduled' && a.kind === 'service' && a.clientPhone,
  );
  if (future?.clientPhone) {
    const dig = String(future.clientPhone).replace(/\D/g, '');
    const phone = dig.startsWith('55') ? dig : `55${dig}`;
    res = await simulate(token, phone, 'quero cancelar');
    for (let i = 0; i < 4; i++) {
      const next =
        (await pickChoice(res, (c) => /sim|confirm|cancel/i.test(c.title || c.id))) ||
        (await pickChoice(res, () => true));
      if (!next) {
        res = await simulate(token, phone, '1');
      } else {
        res = await simulate(token, phone, next);
      }
      await pause(100);
    }
    log('cancel', 'fluxo acionado');
  } else {
    log('cancel', 'sem scheduled seed — skip');
  }

  assert(account?.id, 'account');
  log('OK', 'bot-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
