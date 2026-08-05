import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

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

export async function api(path, { method = 'GET', token, body } = {}) {
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

export async function loginAccount() {
  const { email, password } = demoCredentials();
  const data = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!data.token) throw new Error('Login sem token');
  return data;
}

export function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

export const pause = (ms = 600) => new Promise((r) => setTimeout(r, ms));
