#!/usr/bin/env node
import {
  launchBrowser,
  loginInBrowser,
  log,
  pause,
  typeInto,
} from './lib.mjs';

async function main() {
  const stamp = Date.now();
  const { browser, page, headed } = await launchBrowser();
  try {
    await loginInBrowser(page);
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });
    await pause(800);

    log(1, 'Conta → Abrir suporte');
    await page.getByText('Conta', { exact: true }).first().click();
    await page.waitForURL(/account/i, { timeout: 15000 });
    await page.getByText('Abrir suporte', { exact: true }).first().click();
    await page.waitForURL(/support/i, { timeout: 15000 });
    await pause(800);

    log(2, 'Novo ticket');
    await page.getByText('Novo ticket', { exact: true }).click();
    await pause(500);
    const titleInput = page
      .getByText('Título', { exact: true })
      .locator('xpath=following::input[1]');
    await typeInto(titleInput, `E2E Support ${stamp}`);
    const descBox = page
      .getByText('Descrição', { exact: true })
      .locator('xpath=following::textarea[1]');
    const descInput = page
      .getByText('Descrição', { exact: true })
      .locator('xpath=following::input[1]');
    if (await descBox.count()) {
      await typeInto(descBox, 'Ticket criado no e2e browser');
    } else {
      await typeInto(descInput, 'Ticket criado no e2e browser');
    }
    await page.getByText('Abrir ticket', { exact: true }).click();
    await pause(1500);

    await page
      .getByText(`E2E Support ${stamp}`, { exact: false })
      .first()
      .waitFor({ timeout: 12000 });
    log('OK', 'support-browser');
    if (headed) await pause(2000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
