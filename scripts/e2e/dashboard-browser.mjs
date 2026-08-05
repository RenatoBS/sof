#!/usr/bin/env node
import {
  assert,
  launchBrowser,
  loginInBrowser,
  log,
  pause,
} from './lib.mjs';

async function main() {
  const { browser, page, headed } = await launchBrowser();
  try {
    await loginInBrowser(page);
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });
    await pause(1000);

    log(1, 'Agenda');
    await page.getByText('Agenda', { exact: true }).first().click();
    await page.waitForURL(/agenda/i, { timeout: 15000 });
    await page.getByText('+ Agendar', { exact: false }).first().waitFor({
      timeout: 15000,
    });

    log(2, 'Faturamento');
    const billing = page.getByText('Faturamento', { exact: true }).first();
    assert(await billing.count(), 'aba Faturamento ausente (plano Equipe?)');
    await billing.click();
    await page.waitForURL(/billing/i, { timeout: 15000 });
    await page.getByText('Hoje', { exact: true }).first().waitFor({
      timeout: 10000,
    });
    await page.getByText('Esta semana', { exact: true }).first().waitFor({
      timeout: 5000,
    });

    log(3, 'Conta');
    await page.getByText('Conta', { exact: true }).first().click();
    await page.waitForURL(/account/i, { timeout: 15000 });
    await page.getByText('Abrir suporte', { exact: true }).first().waitFor({
      timeout: 10000,
    });

    log('OK', 'dashboard-browser');
    if (headed) await pause(2000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
