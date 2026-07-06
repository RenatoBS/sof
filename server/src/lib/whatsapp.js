const crypto = require('crypto');
const config = require('../config');

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

// Envia uma mensagem de texto via WhatsApp Cloud API (Meta). Requer WHATSAPP_TOKEN e
// WHATSAPP_PHONE_NUMBER_ID configurados no .env — veja .env.example.
async function sendText(to, body) {
  if (!config.whatsapp.configured) {
    // eslint-disable-next-line no-console
    console.warn('[whatsapp] Envio ignorado — WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados.');
    return null;
  }
  const resp = await fetch(`${GRAPH_API_BASE}/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.whatsapp.token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`WhatsApp Cloud API recusou o envio (${resp.status}): ${text}`);
  }
  return resp.json();
}

// Valida o cabeçalho X-Hub-Signature-256 enviado pela Meta, provando que a chamada
// realmente veio da plataforma (usa o App Secret do app configurado no Meta for Developers).
function verifySignature(req) {
  if (!config.whatsapp.appSecret) return { valid: true, skipped: true };
  const header = req.headers['x-hub-signature-256'];
  if (!header || !req.rawBody) return { valid: false, skipped: false };

  const expected = `sha256=${crypto.createHmac('sha256', config.whatsapp.appSecret).update(req.rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { valid, skipped: false };
}

module.exports = { sendText, verifySignature };
