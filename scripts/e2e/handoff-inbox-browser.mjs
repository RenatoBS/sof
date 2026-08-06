#!/usr/bin/env node
/**
 * E2E browser (Playwright) — inbox Flex de Atendimentos
 *
 * Pré-requisito: `npm run saas` (:8081 + :3001) + seed Equipe.
 * Abre Chromium, faz login, abre handoff via simulador/API, assume e responde na UI.
 *
 * Uso:
 *   npm run test:e2e:handoff-browser
 *   E2E_HEADED=1 npm run test:e2e:handoff-browser
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  api,
  demoCredentials,
  loginAccount,
  log,
  pause,
  WEB_BASE,
  API_BASE,
} from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    resolve(ROOT, 'node_modules/playwright'),
    resolve(ROOT, 'e2e/node_modules/playwright'),
    '/tmp/node_modules/playwright',
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Playwright não encontrado. Rode: cd e2e && npm install && npx playwright install chromium',
  );
}

async function typeInto(locator, value) {
  await locator.click({ timeout: 10000 });
  await locator.fill('');
  await locator.pressSequentially(String(value), { delay: 15 });
}

async function main() {
  const { chromium } = loadPlaywright();
  const headed = process.env.E2E_HEADED === '1' || process.env.E2E_HEADED === 'true';
  const { email, password } = demoCredentials();
  const phone = `55118${String(Date.now()).slice(-8)}`;

  // Abre o handoff via API (mais estável que o simulador UI) antes do browser.
  const { token } = await loginAccount();
  for (const msg of ['oi', 'Bruno Flex UI', 'quero falar com um atendente']) {
    const res = await api('/whatsapp/simulate', {
      method: 'POST',
      token,
      body: { customerPhone: phone, message: msg },
    });
    log('api-sim', `"${msg}" handoff=${Boolean(res.handoffOpened)}`);
  }
  const { handoffs } = await api('/whatsapp-handoffs?status=open', { token });
  const open = (handoffs || []).find((h) => h.customerPhone === phone);
  if (!open) throw new Error('API não abriu handoff para o browser test');
  log('api', `handoff ${open.id} pronto`);

  const browser = await chromium.launch({
    headless: !headed,
    slowMo: headed ? 200 : 0,
    ...(headed
      ? {
          args: [
            '--start-maximized',
            '--window-size=1920,1200',
            '--window-position=0,0',
          ],
        }
      : {}),
  });
  const page = await browser.newPage(
    headed ? { viewport: null } : { viewport: { width: 1280, height: 860 } },
  );
  if (headed) {
    try {
      const session = await page.context().newCDPSession(page);
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'maximized' },
      });
      const { bounds } = await session.send('Browser.getWindowBounds', {
        windowId,
      });
      if ((bounds?.width || 0) < 1840) {
        await session.send('Browser.setWindowBounds', {
          windowId,
          bounds: {
            left: 0,
            top: 0,
            width: 1920,
            height: 1200,
            windowState: 'normal',
          },
        });
      }
    } catch {
      // ignore
    }
  }

  try {
    log(1, 'Login');
    await page.goto(`${WEB_BASE}/login`, { waitUntil: 'networkidle' });
    await pause(1000);
    await typeInto(page.getByPlaceholder('voce@negocio.com'), email);
    await typeInto(page.getByPlaceholder('Sua senha'), password);
    await page.getByRole('button', { name: 'Entrar' }).nth(1).click();
    await page.waitForURL(/agenda|products|setup-catalog|handoffs/i, {
      timeout: 30000,
    });
    log(1, page.url());

    log(2, 'Atendimentos');
    await page.getByText('Atendimentos', { exact: true }).first().click();
    await page.waitForURL(/handoffs/i, { timeout: 15000 });
    await pause(1500);

    const customerLabel = open.customerName || 'Bruno';
    const row = page.getByText(customerLabel, { exact: false }).first();
    await row.click({ timeout: 15000 });
    await pause(1000);
    log(2, `selecionou ${customerLabel}`);

    log(3, 'Assumir');
    const assume = page.getByText('Assumir', { exact: true });
    if (await assume.count()) {
      await assume.first().click();
      await pause(1200);
    } else {
      log(3, 'já atribuído / Assumir ausente — seguindo');
    }

    log(4, 'Responder');
    const composer = page.getByPlaceholder('Escreva a resposta…');
    await composer.waitFor({ timeout: 10000 });
    await typeInto(composer, 'Oi Bruno, equipe Sof no painel (e2e browser).');
    await page.getByText('Enviar', { exact: true }).first().click();
    await pause(2000);

    const bubble = page.getByText('Oi Bruno, equipe Sof no painel (e2e browser).');
    await bubble.first().waitFor({ timeout: 10000 });
    log(4, 'bolha agent visível');

    log(5, 'Resolver');
    await page.getByText('Resolver', { exact: true }).first().click();
    await pause(1500);

    const check = await api(`/whatsapp-handoffs`, { token });
    const again = (check.handoffs || []).find((h) => h.id === open.id);
    if (!again || again.status !== 'resolved') {
      throw new Error(
        `Handoff não resolvido via UI (status=${again?.status || 'missing'})`,
      );
    }
    log(5, 'API confirma resolved');

    await page.screenshot({
      path: resolve(ROOT, 'scripts/e2e/artifacts/handoff-inbox-browser.png'),
      fullPage: true,
    }).catch(() => undefined);

    log('OK', `Browser e2e passou (API ${API_BASE}, web ${WEB_BASE})`);
    if (headed) await pause(8000);
  } catch (err) {
    console.error('[FAIL]', err.message);
    await page
      .screenshot({
        path: resolve(ROOT, 'scripts/e2e/artifacts/handoff-inbox-browser-fail.png'),
        fullPage: true,
      })
      .catch(() => undefined);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
