#!/usr/bin/env node
import {
  api,
  assert,
  loginAccount,
  log,
  uniqueEmail,
  uniquePhone,
} from './lib.mjs';

async function main() {
  const { token } = await loginAccount();
  const stamp = Date.now();

  // Service
  const { service } = await api('/services', {
    method: 'POST',
    token,
    body: { name: `E2E Corte ${stamp}`, duration: 30, price: 55 },
  });
  assert(service?.id, 'service create');
  await api(`/services/${service.id}`, {
    method: 'PUT',
    token,
    body: { name: `E2E Corte Edit ${stamp}`, duration: 35, price: 60 },
  });
  log('service', service.id);

  // Client + pause
  const phone = uniquePhone('1197').slice(2); // DDD local 10–11 digits
  const { client } = await api('/clients', {
    method: 'POST',
    token,
    body: { name: `Cliente E2E ${stamp}`, phone },
  });
  assert(client?.id, 'client create');
  const paused = await api(`/clients/${client.id}`, {
    method: 'PUT',
    token,
    body: {
      name: client.name,
      phone,
      botPausedPermanent: true,
    },
  });
  assert(paused.client?.botPausedPermanent === true, 'pause bot');
  log('client', client.id);

  // Employee
  const { employees: before } = await api('/employees', { token });
  const email = uniqueEmail('prof');
  const created = await api('/employees', {
    method: 'POST',
    token,
    body: {
      name: `Prof E2E ${stamp}`,
      email,
      phone: uniquePhone('1196').slice(2),
      serviceIds: [service.id],
      color: '#c19a6b',
      canHandleHandoffs: true,
    },
  });
  assert(created.employee?.id, 'employee create');
  assert(created.employee.canHandleHandoffs === true, 'canHandleHandoffs');
  log('employee', created.employee.id);

  // Cleanup (respeitar limites / não quebrar seed)
  await api(`/employees/${created.employee.id}`, { method: 'DELETE', token });
  await api(`/clients/${client.id}`, { method: 'DELETE', token });
  await api(`/services/${service.id}`, { method: 'DELETE', token });

  const { employees: after } = await api('/employees', { token });
  assert(after.length === before.length, 'employee cleanup');
  log('OK', 'crud-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
