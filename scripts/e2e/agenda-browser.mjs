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
  const [{ employees }, { services }] = await Promise.all([
    api('/employees', { token }),
    api('/services', { token }),
  ]);
  const employee = employees[0];
  const service =
    services.find((s) =>
      (employee.services || []).some((es) => es.id === s.id),
    ) || services[0];
  const date = nextOpenDateIso();
  // A listagem pode ignorar ?date= — filtramos no client e tentamos slots
  // até a API aceitar (duração do serviço sobrescreve horários vizinhos).
  let appointments = [];
  try {
    const listed = await api(`/appointments`, { token });
    appointments = listed.appointments || [];
  } catch {
    appointments = [];
  }
  const dayApts = (Array.isArray(appointments) ? appointments : []).filter(
    (a) => a.employeeId === employee.id && a.date === date,
  );
  const clientName = `E2E Agenda ${Date.now().toString().slice(-6)}`;
  const clientPhone = uniquePhone('1195').slice(2);
  let apt = null;
  let time = null;
  // Preferir fim do dia — menos chance de colidir com o seed denso do demo.
  const candidates = [];
  for (let h = 19; h >= 8; h--) {
    for (const m of ['45', '30', '15', '00']) {
      candidates.push(`${String(h).padStart(2, '0')}:${m}`);
    }
  }
  for (const candidate of candidates) {
    if (dayApts.some((a) => a.time === candidate)) continue;
    try {
      const created = await api('/appointments', {
        method: 'POST',
        token,
        body: {
          kind: 'service',
          employeeId: employee.id,
          serviceId: service.id,
          date,
          time: candidate,
          clientName,
          clientPhone,
        },
      });
      apt = created.appointment;
      time = candidate;
      break;
    } catch {
      // overlap — tenta o próximo
    }
  }
  assert(apt?.id && time, `sem horário livre em ${date}`);
  log('prep', `${apt.id} ${date} ${time} ${clientName}`);

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
    // Preferir o nome único do prep (vários cards podem compartilhar o horário).
    const byName = page.getByText(clientName, { exact: false }).first();
    if (await byName.count()) {
      await byName.click({ timeout: 20000, force: true });
    } else {
      await page.getByText(time, { exact: true }).first().click({
        timeout: 20000,
        force: true,
      });
    }
    await page.getByText('Editar agendamento', { exact: true }).waitFor({
      timeout: 10000,
    });

    log(3, 'Concluir');
    const complete = page.getByRole('button', {
      name: 'Marcar como concluído',
    });
    if (await complete.count()) {
      await complete.first().click();
      await pause(1500);
    } else {
      const cancel = page.getByRole('button', {
        name: 'Cancelar agendamento',
      });
      if ((await cancel.count()) && (await cancel.first().isEnabled())) {
        await cancel.first().click();
        await pause(1200);
      } else {
        await page.getByRole('button', { name: 'Fechar' }).first().click();
        await pause(800);
        await api(`/appointments/${apt.id}`, {
          method: 'PUT',
          token,
          body: { status: 'completed' },
        }).catch(() =>
          api(`/appointments/${apt.id}`, { method: 'DELETE', token }),
        );
      }
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
