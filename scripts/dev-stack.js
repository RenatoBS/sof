#!/usr/bin/env node
/**
 * Sobe a stack de dev de um produto num único terminal: API Nest + Expo web.
 *
 *   node scripts/dev-stack.js saas    # :3001 + :8081
 *   node scripts/dev-stack.js admin   # :3011 + :8091
 *
 * Na raiz: npm run saas | npm run admin.
 * O Postgres não entra aqui — suba antes com npm run db:up.
 *
 * Sem dependências: a raiz do monorepo não tem node_modules de propósito.
 */
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const STACKS = {
  saas: {
    api: { dir: 'saas/backend', script: 'start:dev', port: 3001 },
    web: { dir: 'saas/frontend', script: 'web', port: 8081 },
  },
  admin: {
    api: { dir: 'admin/backend', script: 'start:dev', port: 3011 },
    web: { dir: 'admin/frontend', script: 'web', port: 8091 },
  },
};

const target = process.argv[2];
const stack = STACKS[target];
if (!stack) {
  console.error(
    `[dev] alvo inválido: ${target || '(vazio)'}. Use: ${Object.keys(STACKS).join(' | ')}`,
  );
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const { dir } of [stack.api, stack.web]) {
  if (!existsSync(path.join(root, dir, 'node_modules'))) {
    console.error(
      `[dev] ${dir} sem node_modules. Rode: npm install --prefix ${dir}`,
    );
    process.exit(1);
  }
}

console.log(`[dev] ${target}: API :${stack.api.port} · web :${stack.web.port}`);

let shuttingDown = false;
const children = [];

function run({ dir, script }, { pipe }) {
  const child = spawn(npm, ['run', script, '--prefix', dir], {
    cwd: root,
    // Só a API é prefixada: o Expo fica com o terminal (QR, atalhos de teclado).
    stdio: pipe ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (pipe) prefixOutput(child, 'api');
  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(
      `[dev] ${dir} encerrou (${signal || `código ${code}`}) — derrubando o resto.`,
    );
    shutdown(typeof code === 'number' ? code : 1);
  });
  child.on('error', (err) => {
    console.error(`[dev] falha ao iniciar ${dir}: ${err.message}`);
    shutdown(1);
  });
  return child;
}

/** Marca cada linha da API para não confundir com o log do Expo no mesmo terminal. */
function prefixOutput(child, tag) {
  for (const [stream, out] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) out.write(`[${tag}] ${line}\n`);
    });
    stream.on('end', () => {
      if (pending) out.write(`[${tag}] ${pending}\n`);
      pending = '';
    });
  }
}

/**
 * `npm run` não repassa sinal para o neto (nest/expo), então um SIGTERM só no
 * wrapper deixa a API e o Metro rodando. Derruba a árvore de baixo para cima.
 */
function killTree(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }
  const found = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' });
  const kids = (found.stdout || '')
    .split('\n')
    .map((line) => Number(line.trim()))
    .filter((kid) => Number.isInteger(kid) && kid > 0);
  for (const kid of kids) killTree(kid);
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // já morreu
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    const alive = child.exitCode === null && child.signalCode === null;
    if (alive) killTree(child.pid);
  }
  // Timer não-unref: garante o código de saída mesmo se os pipes fecharem antes.
  setTimeout(() => process.exit(code), 800);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}

run(stack.api, { pipe: true });
run(stack.web, { pipe: false });
