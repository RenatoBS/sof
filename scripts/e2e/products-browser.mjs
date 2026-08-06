#!/usr/bin/env node
import {
  api,
  launchBrowser,
  loginAccount,
  loginInBrowser,
  log,
  pause,
  simulate,
  typeInto,
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
  const stamp = Date.now();
  const { token } = await loginAccount();
  await api('/account', {
    method: 'PUT',
    token,
    body: { botAttendsProducts: true },
  });

  const { browser, page, headed } = await launchBrowser();
  try {
    await loginInBrowser(page);
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });

    log(1, 'Catálogo — criar produto');
    await page.getByText('Produtos', { exact: true }).first().click();
    await page.waitForURL(/products/i, { timeout: 15000 });
    await page.getByText('Adicionar produto', { exact: true }).first().click();
    await page.getByText('Novo produto', { exact: true }).waitFor({
      timeout: 8000,
    });
    await typeInto(
      page.getByPlaceholder('Ex: Pomada modeladora'),
      `E2E UI Prod ${stamp}`,
    );
    await typeInto(
      page.getByPlaceholder('Detalhes, tamanho, uso…'),
      'Produto e2e browser',
    );
    // Preço: campo sem placeholder — pega inputs do modal
    const priceInput = page
      .getByText('Preço (R$)', { exact: true })
      .locator('xpath=following::input[1]');
    await typeInto(priceInput, '19.9');
    await page.getByText('Salvar', { exact: true }).first().click();
    await pause(1500);
    await page
      .getByText(`E2E UI Prod ${stamp}`, { exact: false })
      .first()
      .waitFor({ timeout: 10000 });
    log(1, 'produto na lista');

    // Prep pedido via bot (melhor esforço) para aba Pedidos
    const phone = uniquePhone('55110');
    let res = await simulate(token, phone, 'oi');
    res = await simulate(token, phone, 'Pedido UI E2E');
    let intent = await pickChoice(res, (c) =>
      /produt|comprar|loja/i.test(c.title || c.id),
    );
    if (!intent) intent = await pickChoice(res, () => true);
    if (intent) {
      res = await simulate(token, phone, intent);
      for (let i = 0; i < 5; i++) {
        if (res.order) break;
        const next = await pickChoice(res, () => true);
        res = await simulate(token, phone, next || '1');
        await pause(100);
      }
    }

    log(2, 'Aba Pedidos');
    await page.getByText('Pedidos', { exact: true }).first().click();
    await pause(1500);
    await page.getByText(/pedido|nenhum|whatsapp/i).first().waitFor({
      timeout: 10000,
    });
    log(2, 'pedidos tab ok');

    log('OK', 'products-browser');
    if (headed) await pause(2000);
  } finally {
    await browser.close();
    // cleanup produto de teste
    const { products } = await api('/products', { token });
    const prod = (products || []).find((p) =>
      String(p.name).includes(`E2E UI Prod ${stamp}`),
    );
    if (prod) {
      await api(`/products/${prod.id}`, { method: 'DELETE', token }).catch(
        () => undefined,
      );
    }
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
