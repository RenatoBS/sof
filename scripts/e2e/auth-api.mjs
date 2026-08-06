#!/usr/bin/env node
import {
  api,
  assert,
  demoCredentials,
  ensureEmployeePassword,
  loginAccount,
  loginEmployee,
  log,
  EMPLOYEE_EMAIL,
} from './lib.mjs';

async function main() {
  const { email, password } = demoCredentials();

  const login = await loginAccount();
  log('login', `${login.account.email}`);
  const me = await api('/auth/me', { token: login.token });
  assert(me.account?.id === login.account.id, 'me != login account');

  await api('/auth/logout', { method: 'POST', token: login.token });
  log('logout', 'conta');

  const again = await loginAccount();
  const { employees } = await api('/employees', { token: again.token });
  const emp =
    employees.find((e) => e.email === EMPLOYEE_EMAIL) || employees[0];
  assert(emp, 'seed sem profissionais');

  const empSession = await ensureEmployeePassword(again.token, emp, password);
  log('employee', `senha ok ${empSession.employee.email}`);
  assert(!empSession.employee.mustChangePassword, 'mustChangePassword ainda true');

  const empMe = await api('/employee-auth/me', { token: empSession.token });
  assert(empMe.employee?.id === emp.id, 'employee me mismatch');

  await api('/employee-auth/logout', {
    method: 'POST',
    token: empSession.token,
  });
  log('logout', 'profissional');

  // Re-login employee
  await loginEmployee(emp.email, password);

  const reset = await api('/auth/request-password-reset', {
    method: 'POST',
    body: { email },
  });
  assert(reset.ok === true, 'request-password-reset sem ok');
  log('reset', 'request-password-reset ok');

  // change-password exige senha diferente; troca e restaura
  const emp2 = await loginEmployee(emp.email, password);
  const tempPass = `${password}-e2e`;
  const changed = await api('/employee-auth/change-password', {
    method: 'POST',
    token: emp2.token,
    body: { currentPassword: password, newPassword: tempPass },
  });
  assert(changed.employee?.id, 'change-password falhou');
  const emp3 = await loginEmployee(emp.email, tempPass);
  await api('/employee-auth/change-password', {
    method: 'POST',
    token: emp3.token,
    body: { currentPassword: tempPass, newPassword: password },
  });
  log('OK', 'auth-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
