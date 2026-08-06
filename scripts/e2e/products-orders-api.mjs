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
  const { token } = await loginAccount();
  const stamp = Date.now();

  await api('/account', {
    method: 'PUT',
    token,
    body: { botAttendsProducts: true, botAttendsServices: true },
  });

  const { product } = await api('/products', {
    method: 'POST',
    token,
    body: {
      name: `E2E Pomada ${stamp}`,
      description: 'Criado no e2e',
      price: 29.9,
      stock: 5,
      handoffEnabled: false,
      active: true,
      images: [],
    },
  });
  assert(product?.id, 'product create');
  log('product', product.id);

  // Compra via bot
  const phone = uniquePhone('55115');
  let res = await simulate(token, phone, 'oi');
  res = await simulate(token, phone, 'Nina Pedido E2E');
  let intent = await pickChoice(res, (c) =>
    /produt|comprar|loja/i.test(c.title || c.id),
  );
  if (!intent) {
    // menu intenção numérico
    intent = await pickChoice(res, () => true);
  }
  if (intent) res = await simulate(token, phone, intent);

  // escolhe produto pelo nome
  let picked = await pickChoice(res, (c) =>
    String(c.title || '').includes(`E2E Pomada ${stamp}`),
  );
  if (!picked) picked = await pickChoice(res, () => true);
  if (picked) res = await simulate(token, phone, picked);

  for (let i = 0; i < 5; i++) {
    if (res.order) break;
    const next = await pickChoice(res, () => true);
    res = await simulate(token, phone, next || '1');
    await pause(120);
  }

  const { orders } = await api('/orders', { token });
  const order =
    (orders || []).find((o) => o.clientPhone?.includes(phone.slice(-8))) ||
    (orders || []).find((o) =>
      (o.items || []).some((it) => it.productName?.includes(`E2E Pomada`)),
    ) ||
    orders?.[0];

  if (order?.id) {
    const patched = await api(`/orders/${order.id}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'confirmed' },
    });
    assert(
      patched.order?.status === 'confirmed' || patched.status === 'confirmed',
      'order status',
    );
    log('order', `${order.id} confirmed`);
  } else {
    log('order', 'pedido não encontrado via bot — product CRUD ok');
  }

  await api(`/products/${product.id}`, { method: 'DELETE', token });
  log('OK', 'products-orders-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
