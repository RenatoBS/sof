#!/usr/bin/env node
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launchBrowser,
  loginInBrowser,
  log,
  pause,
  typeInto,
  uniquePhone,
} from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function main() {
  const stamp = Date.now();
  // 11 dígitos locais (DDD + 9)
  const phoneLocal = `11${String(Date.now()).slice(-9)}`;
  const { browser, page, headed } = await launchBrowser();
  try {
    await loginInBrowser(page);
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });
    await pause(800);

    log(1, 'Serviços');
    await page.getByText('Serviços', { exact: true }).first().click();
    await page.waitForURL(/services/i, { timeout: 15000 });
    await page.getByText('Adicionar serviço', { exact: true }).first().click();
    await page.getByText('Novo serviço', { exact: true }).waitFor({
      timeout: 8000,
    });
    await typeInto(page.getByPlaceholder('Ex: Corte'), `E2E Svc ${stamp}`);
    await page.getByText('Salvar', { exact: true }).first().click();
    await pause(1500);
    await page.getByText(`E2E Svc ${stamp}`, { exact: false }).first().waitFor({
      timeout: 10000,
    });
    log(1, 'serviço na lista');

    log(2, 'Clientes');
    await page.getByText('Clientes', { exact: true }).first().click();
    await page.waitForURL(/clients/i, { timeout: 15000 });
    await page.getByText('Adicionar cliente', { exact: true }).first().click();
    await page.getByText('Novo cliente', { exact: true }).waitFor({
      timeout: 8000,
    });
    await typeInto(
      page.getByPlaceholder('Nome do cliente'),
      `E2E Cli ${stamp}`,
    );
    log(2, `phone=${phoneLocal}`);
    await typeInto(page.getByPlaceholder('(11) 99999-0000'), phoneLocal);
    await page.getByText('Salvar', { exact: true }).first().click();
    await pause(2000);

    const stillModal = await page.getByText('Novo cliente', { exact: true }).count();
    if (stillModal) {
      const bodyText = await page.locator('body').innerText();
      log(2, `modal ainda aberto; snippet=${bodyText.slice(0, 400)}`);
      await page.screenshot({
        path: resolve(ROOT, 'scripts/e2e/artifacts/crud-client-fail.png'),
        fullPage: true,
      }).catch(() => undefined);
      throw new Error('Cliente não salvou — modal ainda aberto');
    }

    await page.getByText(`E2E Cli ${stamp}`, { exact: false }).first().waitFor({
      timeout: 12000,
    });
    log(2, 'cliente na lista');

    log(3, 'Profissionais');
    await page.getByText('Profissionais', { exact: true }).first().click();
    await page.waitForURL(/employees/i, { timeout: 15000 });
    await page
      .getByText('Adicionar profissional', { exact: true })
      .first()
      .waitFor({ timeout: 10000 });
    log(3, 'lista profissionais ok');

    log('OK', 'crud-browser');
    if (headed) await pause(2000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
