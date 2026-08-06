#!/usr/bin/env node
import { api, assert, loginAccount, log } from './lib.mjs';

async function main() {
  const { token, account } = await loginAccount();

  const integrations = await api('/account/integrations', { token });
  assert(integrations, 'integrations');

  const wa = await api('/account/whatsapp/status', { token });
  log('wa', `status keys=${Object.keys(wa || {}).join(',')}`);

  const before = Boolean(account.botAttendsProducts);
  await api('/account', {
    method: 'PUT',
    token,
    body: { botAttendsProducts: !before, botAttendsServices: true },
  });
  const me = await api('/auth/me', { token });
  assert(
    Boolean(me.account.botAttendsProducts) === !before,
    'botAttendsProducts não alterou',
  );
  // restore
  await api('/account', {
    method: 'PUT',
    token,
    body: {
      botAttendsProducts: before,
      botAttendsServices: me.account.botAttendsServices !== false,
    },
  });
  log('OK', 'account-api');
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  if (err.data) console.error(JSON.stringify(err.data));
  process.exitCode = 1;
});
