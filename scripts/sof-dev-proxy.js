#!/usr/bin/env node
/**
 * Reverse proxy local para expor Sof (Expo web + Nest API) num único túnel ngrok.
 *
 *   /api/*  → http://127.0.0.1:3001  (Nest)
 *   resto   → http://127.0.0.1:8081  (Expo web)
 *
 * Uso:
 *   1. Suba Postgres, API (:3001) e front (:8081)
 *   2. node scripts/sof-dev-proxy.js          # default :9080
 *   3. ngrok http 9080
 *   4. Ajuste envs (ver docs/local-development.md → “Acesso remoto via ngrok”)
 *
 * Depende de: npm install http-proxy (na raiz ou em qualquer cwd com o pacote).
 */
'use strict';

let httpProxy;
try {
  httpProxy = require('http-proxy');
} catch {
  console.error(
    '[sof-dev-proxy] Falta o pacote http-proxy. Rode: npm install http-proxy',
  );
  process.exit(1);
}

const http = require('http');

const FRONT = process.env.SOF_FRONT_URL || 'http://127.0.0.1:8081';
const API = process.env.SOF_API_URL || 'http://127.0.0.1:3001';
const PORT = Number(process.env.PROXY_PORT || 9080);

const proxy = httpProxy.createProxyServer({ ws: true });

proxy.on('error', (err, _req, res) => {
  console.error('[sof-dev-proxy]', err.message);
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway');
  } else if (res && res.destroy) {
    res.destroy();
  }
});

proxy.on('proxyReq', (proxyReq, req) => {
  // Metro (Expo) quebra com x-forwarded-* multi-valor do ngrok → TypeError: Invalid URL.
  for (const h of [
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-forwarded-for',
    'x-forwarded-port',
    'x-forwarded-scheme',
    'forwarded',
  ]) {
    proxyReq.removeHeader(h);
  }
  const publicHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (publicHost && !(req.url || '').startsWith('/api')) {
    const host = Array.isArray(publicHost)
      ? publicHost[0]
      : String(publicHost).split(',')[0].trim();
    proxyReq.setHeader('host', host);
  }
});

const server = http.createServer((req, res) => {
  const isApi = (req.url || '').startsWith('/api');
  const target = isApi ? API : FRONT;
  // Front: changeOrigin=false para o CorsMiddleware do Expo ver mesma origem (ngrok).
  proxy.web(req, res, { target, changeOrigin: isApi });
});

server.on('upgrade', (req, socket, head) => {
  const isApi = (req.url || '').startsWith('/api');
  const target = isApi ? API : FRONT;
  proxy.ws(req, socket, head, { target, changeOrigin: isApi });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sof-dev-proxy] :${PORT}`);
  console.log(`  /api/* → ${API}`);
  console.log(`  /*     → ${FRONT}`);
  console.log(`  ngrok http ${PORT}`);
});
