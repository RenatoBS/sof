#!/usr/bin/env node
/**
 * Flex browser: inbox da conta (claim/reply) + portal do profissional.
 */
import {
  api,
  assert,
  demoCredentials,
  ensureEmployeePassword,
  EMPLOYEE_EMAIL,
  launchBrowser,
  loginAccount,
  loginInBrowser,
  log,
  pause,
  simulate,
  typeInto,
  uniquePhone,
  WEB_BASE,
} from './lib.mjs';

async function openHandoff(token, phone, name) {
  await simulate(token, phone, 'oi');
  await simulate(token, phone, name);
  const res = await simulate(token, phone, 'quero falar com um atendente');
  log('sim', `handoffOpened=${Boolean(res.handoffOpened)}`);
  const { handoffs } = await api('/whatsapp-handoffs?status=open', { token });
  const h = (handoffs || []).find((x) => x.customerPhone === phone);
  assert(h, 'handoff não aberto');
  return h;
}

async function main() {
  const { password } = demoCredentials();
  const { token } = await loginAccount();
  const { employees } = await api('/employees', { token });
  const emp =
    employees.find((e) => e.email === EMPLOYEE_EMAIL) || employees[0];
  assert(emp, 'seed sem profissional');

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
  await ensureEmployeePassword(
    token,
    { ...emp, canHandleHandoffs: true },
    password,
  );

  const phoneAccount = uniquePhone('55109');
  const hAccount = await openHandoff(token, phoneAccount, 'Flex Conta UI');

  const { browser, page, headed } = await launchBrowser();
  try {
    log(1, 'Conta — Atendimentos');
    await loginInBrowser(page);
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });
    await page.getByText('Atendimentos', { exact: true }).first().click();
    await page.waitForURL(/handoffs/i, { timeout: 15000 });
    await pause(1200);

    await page
      .getByText(hAccount.customerName || 'Flex Conta', { exact: false })
      .first()
      .click({ timeout: 15000 });
    await pause(800);
    const assume = page.getByText('Assumir', { exact: true });
    if (await assume.count()) {
      await assume.first().click();
      await pause(1000);
    }
    const composer = page.getByPlaceholder('Escreva a resposta…');
    await composer.waitFor({ timeout: 10000 });
    await typeInto(composer, 'Resposta e2e flex conta.');
    await page.getByText('Enviar', { exact: true }).first().click();
    await pause(1500);
    await page.getByText('Resolver', { exact: true }).first().click();
    await pause(1200);
    log(1, 'conta inbox ok');

    log(2, 'Portal profissional — Atendimentos');
    await page.getByLabel('Sair').click();
    await pause(1000);

    const phoneEmp = uniquePhone('55108');
    const hEmp = await openHandoff(token, phoneEmp, 'Flex Prof UI');

    await page.goto(`${WEB_BASE}/login`, { waitUntil: 'networkidle' });
    await pause(600);
    await typeInto(page.getByPlaceholder('voce@negocio.com'), emp.email);
    await typeInto(page.getByPlaceholder('Sua senha'), password);
    await page.getByRole('button', { name: 'Entrar' }).nth(1).click();
    await page.waitForURL(/employee\/agenda|agenda|change-password|handoffs/i, {
      timeout: 30000,
    });
    if (/change-password/i.test(page.url())) {
      await typeInto(
        page.getByPlaceholder('Senha temporária ou atual'),
        password,
      );
      await typeInto(page.getByPlaceholder('Mínimo 6 caracteres'), password);
      await typeInto(page.getByPlaceholder('Repita a nova senha'), password);
      await page.getByText('Salvar e continuar', { exact: true }).click();
      await page.waitForURL(/agenda/i, { timeout: 20000 });
    }

    await page.getByText('Atendimentos', { exact: true }).first().click();
    await page.waitForURL(/handoffs/i, { timeout: 15000 });
    await pause(1200);
    await page
      .getByText(hEmp.customerName || 'Flex Prof', { exact: false })
      .first()
      .click({ timeout: 15000 });
    await pause(800);
    const assume2 = page.getByText('Assumir', { exact: true });
    if (await assume2.count()) {
      await assume2.first().click();
      await pause(1000);
    }
    await typeInto(
      page.getByPlaceholder('Escreva a resposta…'),
      'Resposta e2e flex profissional.',
    );
    await page.getByText('Enviar', { exact: true }).first().click();
    await pause(1500);
    await page.getByText('Resolver', { exact: true }).first().click();
    await pause(1200);

    const check = await api('/whatsapp-handoffs', { token });
    const resolved = (check.handoffs || []).find((h) => h.id === hEmp.id);
    assert(
      !resolved || resolved.status === 'resolved',
      `prof handoff status=${resolved?.status}`,
    );

    log('OK', 'flex-browser');
    if (headed) await pause(2000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
