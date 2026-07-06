const crypto = require('crypto');
const config = require('../config');

const API_BASE = 'https://api.mercadopago.com';

async function createPreference({ sessionId, planName, price, payerEmail }) {
  const body = {
    items: [
      {
        id: `plan-${planName}`,
        title: `Assinatura Soft — Plano ${planName}`,
        description: 'Assinatura mensal do painel de agendamentos Soft.',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: price,
      },
    ],
    payer: { email: payerEmail },
    external_reference: sessionId,
    back_urls: {
      success: `${config.publicUrl}/site/checkout-retorno.html?ref=${sessionId}`,
      pending: `${config.publicUrl}/site/checkout-retorno.html?ref=${sessionId}`,
      failure: `${config.publicUrl}/site/checkout-retorno.html?ref=${sessionId}`,
    },
    auto_return: 'approved',
    notification_url: `${config.publicUrl}/api/payments/webhook`,
    statement_descriptor: 'SOFT AGENDAMENTO',
  };

  const resp = await fetch(`${API_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.mercadoPago.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Mercado Pago recusou a criação da preferência (${resp.status}): ${text}`);
  }

  return resp.json();
}

async function getPayment(paymentId) {
  const resp = await fetch(`${API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${config.mercadoPago.accessToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Falha ao consultar pagamento no Mercado Pago (${resp.status}): ${text}`);
  }
  return resp.json();
}

// Valida a assinatura do webhook conforme a documentação do Mercado Pago:
// header x-signature = "ts=<timestamp>,v1=<hash>", assinado sobre um manifest com o id do recurso.
// https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/notifications/webhooks
function verifyWebhookSignature(req, resourceId) {
  if (!config.mercadoPago.webhookSecret) {
    return { valid: true, skipped: true };
  }
  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (!signatureHeader) return { valid: false, skipped: false };

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(',')
      .map((piece) => piece.trim().split('=').map((s) => s.trim()))
      .filter((pair) => pair.length === 2)
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return { valid: false, skipped: false };

  const manifest = `id:${resourceId};request-id:${requestId || ''};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', config.mercadoPago.webhookSecret)
    .update(manifest)
    .digest('hex');

  const valid = expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  return { valid, skipped: false };
}

module.exports = { createPreference, getPayment, verifyWebhookSignature };
