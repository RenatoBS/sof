#!/usr/bin/env node
/**
 * Runner da suíte E2E Sof.
 *
 *   node scripts/e2e/run.mjs --suite=api
 *   node scripts/e2e/run.mjs --suite=browser
 *   node scripts/e2e/run.mjs --suite=all
 *
 * E2E_FAIL_FAST=0 continua após falha.
 */
import { log, pause, runScript, scriptPath } from './lib.mjs';

const suiteArg =
  process.argv.find((a) => a.startsWith('--suite='))?.split('=')[1] ||
  process.env.E2E_SUITE ||
  'all';

const failFast = process.env.E2E_FAIL_FAST !== '0';
/** Pausa entre scripts para não estourar ThrottlerGuard global. */
const BETWEEN_MS = Number(process.env.E2E_BETWEEN_MS || 1500);

const API_SCRIPTS = [
  'auth-api.mjs',
  'agenda-api.mjs',
  'crud-api.mjs',
  'bot-api.mjs',
  'products-orders-api.mjs',
  'flex-api.mjs',
  'support-api.mjs',
  'account-api.mjs',
];

const BROWSER_SCRIPTS = [
  'auth-browser.mjs',
  'dashboard-browser.mjs',
  'agenda-browser.mjs',
  'crud-browser.mjs',
  'products-browser.mjs',
  'support-browser.mjs',
  'flex-browser.mjs',
];

async function runList(label, files) {
  const failures = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (i > 0 && BETWEEN_MS > 0) await pause(BETWEEN_MS);
    log(label, `→ ${file}`);
    try {
      await runScript(scriptPath(file));
      log(label, `OK ${file}`);
    } catch (err) {
      log(label, `FAIL ${file}: ${err.message}`);
      failures.push(file);
      if (failFast) break;
    }
  }
  return failures;
}

async function main() {
  const suite = suiteArg.toLowerCase();
  let failures = [];

  if (suite === 'api' || suite === 'all') {
    failures = failures.concat(await runList('api', API_SCRIPTS));
  }
  if (
    (suite === 'browser' || suite === 'all') &&
    (failures.length === 0 || !failFast)
  ) {
    failures = failures.concat(await runList('browser', BROWSER_SCRIPTS));
  }

  if (failures.length) {
    console.error(`[FAIL] ${failures.length} script(s): ${failures.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  log('OK', `suite=${suite} completa`);
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
