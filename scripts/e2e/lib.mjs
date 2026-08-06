import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../..');

/** Tamanho do display X11 (gravações headed) — fallback 1920×1080. */
export function displayScreenSize() {
  try {
    const display = process.env.DISPLAY || ':1';
    const out = execSync(`xdpyinfo -display ${display}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const m = out.match(/dimensions:\s+(\d+)x(\d+)/);
    if (m) return { width: Number(m[1]), height: Number(m[2]) };
  } catch {
    // headless / sem X
  }
  return { width: 1920, height: 1080 };
}

/** Lê `saas/backend/.env` sem depender de dotenv. */
export function loadBackendEnv() {
  const path = resolve(ROOT, 'saas/backend/.env');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function demoCredentials() {
  const env = loadBackendEnv();
  return {
    email: process.env.E2E_EMAIL || env.SEED_DEMO_EMAIL || 'demo@sof.com',
    password:
      process.env.E2E_PASSWORD || env.SEED_DEMO_PASSWORD || 'demo123',
  };
}

export const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';
export const WEB_BASE = process.env.E2E_WEB_URL || 'http://localhost:8081';
export const EMPLOYEE_EMAIL =
  process.env.E2E_EMPLOYEE_EMAIL || 'marcelo@demo.sof';

export async function api(path, { method = 'GET', token, body, auth } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      data?.error || data?.message || `HTTP ${res.status} ${path}`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** api que não lança — devolve { ok, status, data } */
export async function apiRaw(path, opts = {}) {
  const headers = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

export async function loginAccount() {
  const { email, password } = demoCredentials();
  const data = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!data.token) throw new Error('Login conta sem token');
  return data;
}

export async function loginEmployee(email = EMPLOYEE_EMAIL, password) {
  const { password: demoPass } = demoCredentials();
  const data = await api('/employee-auth/login', {
    method: 'POST',
    body: { email, password: password || demoPass },
  });
  if (!data.token) throw new Error('Login profissional sem token');
  return data;
}

/**
 * Garante senha conhecida no profissional (seed vem com mustChangePassword).
 * Usa PUT resetPassword → password-setup (não depende de WhatsApp).
 */
export async function ensureEmployeePassword(
  accountToken,
  employee,
  password,
) {
  const { password: demoPass } = demoCredentials();
  const pass = password || demoPass;
  const phone =
    String(employee.phone || '').replace(/\D/g, '') || '11988881111';
  const serviceIds = (employee.services || []).map((s) => s.id);
  if (!serviceIds.length) {
    throw new Error(
      `Profissional ${employee.email} sem serviços — seed incompleto`,
    );
  }

  const updated = await api(`/employees/${employee.id}`, {
    method: 'PUT',
    token: accountToken,
    body: {
      name: employee.name,
      email: employee.email,
      phone,
      serviceIds,
      color: employee.color || '#3b82f6',
      canHandleHandoffs: Boolean(employee.canHandleHandoffs),
      resetPassword: true,
    },
  });

  const resetLink = updated.resetLink;
  if (!resetLink) {
    // Já tinha senha e reset não pediu link — tenta login direto
    return loginEmployee(employee.email, pass);
  }

  const url = new URL(resetLink, WEB_BASE);
  const token =
    url.searchParams.get('token') ||
    String(resetLink).split('token=')[1]?.split('&')[0];
  if (!token) throw new Error(`resetLink sem token: ${resetLink}`);

  const setup = await api('/employee-auth/password-setup', {
    method: 'POST',
    body: { token, password: pass },
  });
  if (!setup.token) throw new Error('password-setup sem token');
  return setup;
}

export function uniquePhone(prefix = '55119') {
  return `${prefix}${String(Date.now()).slice(-8)}`;
}

export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}.${Date.now()}@e2e.sof.test`;
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

export function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

export const pause = (ms = 600) => new Promise((r) => setTimeout(r, ms));

export async function simulate(token, phone, message) {
  return api('/whatsapp/simulate', {
    method: 'POST',
    token,
    body: { customerPhone: phone, message },
  });
}

/** Próximo dia útil YYYY-MM-DD (pula domingo). */
export function nextOpenDateIso(from = new Date()) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadPlaywright() {
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
      /* next */
    }
  }
  throw new Error(
    'Playwright não encontrado. Rode: cd e2e && npm install && npx playwright install chromium',
  );
}

export async function typeInto(locator, value) {
  await locator.click({ timeout: 10000 });
  await locator.fill('');
  await locator.pressSequentially(String(value), { delay: 12 });
}

export async function loginInBrowser(page, { email, password } = {}) {
  const creds = demoCredentials();
  const e = email || creds.email;
  const p = password || creds.password;
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'networkidle' });
  await pause(800);
  await typeInto(page.getByPlaceholder('voce@negocio.com'), e);
  await typeInto(page.getByPlaceholder('Sua senha'), p);
  await page.getByRole('button', { name: 'Entrar' }).nth(1).click();
}

export function headedBrowser() {
  return process.env.E2E_HEADED === '1' || process.env.E2E_HEADED === 'true';
}

export async function launchBrowser() {
  const { chromium } = loadPlaywright();
  const headed = headedBrowser();
  const screen = displayScreenSize();
  const browser = await chromium.launch({
    headless: !headed,
    slowMo: headed ? 180 : 0,
    // Headed: fill the display so demos/recordings are not a small floating window.
    ...(headed
      ? {
          args: [
            '--start-maximized',
            `--window-size=${screen.width},${screen.height}`,
            '--window-position=0,0',
          ],
        }
      : {}),
  });
  // null viewport lets the real window size dictate layout (Playwright default is 1280x720).
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
      let { bounds } = await session.send('Browser.getWindowBounds', {
        windowId,
      });
      // Some WMs ignore maximize; force explicit bounds to the display size.
      if ((bounds?.width || 0) < screen.width - 80) {
        await session.send('Browser.setWindowBounds', {
          windowId,
          bounds: {
            left: 0,
            top: 0,
            width: screen.width,
            height: screen.height,
            windowState: 'normal',
          },
        });
        ({ bounds } = await session.send('Browser.getWindowBounds', {
          windowId,
        }));
      }
      log('browser', `window ${bounds.width}x${bounds.height} (${bounds.windowState})`);
    } catch (err) {
      log('browser', `maximize skip: ${err?.message || err}`);
    }
  }
  return { browser, page, headed };
}

export function runScript(file) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [file], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${file} exited ${code}`));
    });
    child.on('error', reject);
  });
}

export function scriptPath(name) {
  return resolve(__dirname, name);
}
