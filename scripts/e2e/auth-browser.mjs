#!/usr/bin/env node
import {
  assert,
  demoCredentials,
  ensureEmployeePassword,
  EMPLOYEE_EMAIL,
  launchBrowser,
  loginAccount,
  loginInBrowser,
  log,
  pause,
  typeInto,
  WEB_BASE,
  api,
} from './lib.mjs';

async function main() {
  const { password } = demoCredentials();
  const { token } = await loginAccount();
  const { employees } = await api('/employees', { token });
  const emp =
    employees.find((e) => e.email === EMPLOYEE_EMAIL) || employees[0];
  assert(emp, 'seed sem profissional');
  await ensureEmployeePassword(token, emp, password);

  const { browser, page, headed } = await launchBrowser();
  try {
    log(1, 'Login conta');
    await loginInBrowser(page);
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });
    await page.getByText('Agenda', { exact: true }).first().waitFor({
      timeout: 15000,
    });
    log(1, page.url());

    log(2, 'Logout');
    await page.getByLabel('Sair').click();
    await pause(1200);
    await page.goto(`${WEB_BASE}/login`, { waitUntil: 'networkidle' });
    await pause(600);

    log(3, 'Login profissional');
    await typeInto(page.getByPlaceholder('voce@negocio.com'), emp.email);
    await typeInto(page.getByPlaceholder('Sua senha'), password);
    await page.getByRole('button', { name: 'Entrar' }).nth(1).click();
    await page.waitForURL(/change-password|agenda/i, { timeout: 30000 });

    if (/change-password/i.test(page.url())) {
      log(3, 'change-password gate');
      await typeInto(
        page.getByPlaceholder('Senha temporária ou atual'),
        password,
      );
      await typeInto(page.getByPlaceholder('Mínimo 6 caracteres'), password);
      await typeInto(page.getByPlaceholder('Repita a nova senha'), password);
      await page.getByText('Salvar e continuar', { exact: true }).click();
      await page.waitForURL(/agenda/i, { timeout: 20000 });
    }

    // Portal do profissional: topbar com nome + Sair (sem tab "Agenda")
    await page.getByLabel('Sair').waitFor({ timeout: 15000 });
    await page.getByText(emp.name, { exact: false }).first().waitFor({
      timeout: 10000,
    });
    log('OK', `auth-browser portal ${page.url()}`);
    if (headed) await pause(2000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
