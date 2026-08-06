#!/usr/bin/env node
import {
  api,
  assert,
  loginAccount,
  log,
  nextOpenDateIso,
  uniquePhone,
} from './lib.mjs';

async function main() {
  const { token } = await loginAccount();
  const [{ employees }, { services }, { clients }] = await Promise.all([
    api('/employees', { token }),
    api('/services', { token }),
    api('/clients', { token }),
  ]);
  assert(employees.length && services.length, 'seed sem employee/service');

  const employee = employees[0];
  const service =
    services.find((s) =>
      (employee.services || []).some((es) => es.id === s.id),
    ) || services[0];
  const client = clients[0] || null;
  const date = nextOpenDateIso();

  const created = await api('/appointments', {
    method: 'POST',
    token,
    body: {
      kind: 'service',
      employeeId: employee.id,
      serviceId: service.id,
      date,
      time: '10:00',
      clientId: client?.id,
      clientName: client?.name || 'Cliente E2E',
      clientPhone: client?.phone || uniquePhone('1199').slice(2),
    },
  });
  const apt = created.appointment;
  assert(apt?.id, 'appointment não criado');
  log('create', `${apt.id} ${date} 10:00`);

  const completed = await api(`/appointments/${apt.id}/complete`, {
    method: 'POST',
    token,
  });
  assert(completed.appointment?.status === 'completed', 'complete falhou');
  log('complete', 'ok');

  const created2 = await api('/appointments', {
    method: 'POST',
    token,
    body: {
      kind: 'service',
      employeeId: employee.id,
      serviceId: service.id,
      date,
      time: '11:00',
      clientId: client?.id,
      clientName: client?.name || 'Cliente E2E 2',
      clientPhone: client?.phone || uniquePhone('1198').slice(2),
    },
  });
  await api(`/appointments/${created2.appointment.id}`, {
    method: 'DELETE',
    token,
  });
  log('cancel', 'delete ok');

  const block = await api('/appointments', {
    method: 'POST',
    token,
    body: {
      kind: 'block',
      title: 'E2E almoço',
      durationMinutes: 30,
      employeeId: employee.id,
      date,
      time: '12:00',
    },
  });
  assert(block.appointment?.kind === 'block', 'block não criado');
  await api(`/appointments/${block.appointment.id}`, {
    method: 'DELETE',
    token,
  });
  log('OK', 'agenda-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
