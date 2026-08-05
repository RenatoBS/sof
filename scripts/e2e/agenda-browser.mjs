#!/usr/bin/env node
import {
  api,
  assert,
  launchBrowser,
  loginAccount,
  loginInBrowser,
  log,
  nextOpenDateIso,
  pause,
  uniquePhone,
} from './lib.mjs';

async function main() {
  const { token } = await loginAccount();
  const [{ employees }, { services }, { clients }] = await Promise.all([
    api('/employees', { token }),
    api('/services', { token }),
    api('/clients', { token }),
  ]);
  const employee = employees[0];
  const service =
    services.find((s) =>
      (employee.services || []).some((es) => es.id === s.id),
    ) || services[0];
  const client = clients[0];
  const date = nextOpenDateIso();
  const time = '15:45';
  const clientName = client?.name || `E2E Agenda UI`;

  const created = await api('/appointments', {
    method: 'POST',
    token,
    body: {
      kind: 'service',
      employeeId: employee.id,
      serviceId: service.id,
      date,
      time,
      clientId: client?.id,
      clientName,
      clientPhone: client?.phone || uniquePhone('1195').slice(2),
    },
  });
  const apt = created.appointment;
  assert(apt?.id, 'prep appointment');
  log('prep', `${apt.id} ${date} ${time}`);

  const { browser, page, headed } = await launchBrowser();
  try {
    await loginInBrowser(page);
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });
    await page.getByText('Agenda', { exact: true }).first().click();
    await page.waitForURL(/agenda/i, { timeout: 15000 });
    await pause(1500);

    log(1, '+ Agendar abre modal');
    await page.getByText('+ Agendar', { exact: true }).first().click();
    await page.getByText('Novo agendamento', { exact: true }).waitFor({
      timeout: 10000,
    });
    await page.getByText('Fechar', { exact: true }).first().click();
    await pause(800);
    log(1, 'modal ok');

    log(2, 'Abrir agendamento prep');
    // Busca o card pelo horário (evita overlap de nomes de serviço)
    const slot = page.getByText(time, { exact: true }).first();
    await slot.click({ timeout: 20000, force: true });
    await page.getByText('Editar agendamento', { exact: true }).waitFor({
      timeout: 10000,
    });

    log(3, 'Concluir');
    const complete = page.getByText('Marcar como concluído', { exact: true });
    if (await complete.count()) {
      await complete.first().click();
      await pause(1500);
    } else {
      await page.getByText('Cancelar agendamento', { exact: true }).click();
      await pause(1200);
    }

    const check = await api(`/appointments`, { token });
    const again = (check.appointments || []).find((a) => a.id === apt.id);
    assert(
      !again || again.status === 'completed' || again.status === 'cancelled',
      `status inesperado ${again?.status}`,
    );
    log('OK', `agenda-browser status=${again?.status || 'deleted'}`);
    if (headed) await pause(2000);
  } finally {
    await browser.close();
    await api(`/appointments/${apt.id}`, { method: 'DELETE', token }).catch(
      () => undefined,
    );
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
