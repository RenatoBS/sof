const express = require('express');
const db = require('../db');
const config = require('../config');
const mercadopago = require('../lib/mercadopago');
const { provisionAccount } = require('../lib/provisionAccount');

const router = express.Router();

// Webhook de notificações do Mercado Pago. Configure a URL pública
// `${PUBLIC_URL}/api/payments/webhook` no painel do Mercado Pago (Suas integrações > Webhooks).
router.post('/webhook', async (req, res) => {
  const type = req.body?.type || req.query.type;
  const paymentId = req.body?.data?.id || req.query['data.id'];

  if (type !== 'payment' || !paymentId) {
    // Outros tipos de evento (merchant_order, etc.) são apenas confirmados sem ação.
    return res.sendStatus(200);
  }

  const { valid, skipped } = mercadopago.verifyWebhookSignature(req, paymentId);
  if (!valid) {
    // eslint-disable-next-line no-console
    console.warn('[webhook] Assinatura do Mercado Pago inválida, ignorando notificação.');
    return res.sendStatus(401);
  }
  if (skipped) {
    // eslint-disable-next-line no-console
    console.warn('[webhook] MP_WEBHOOK_SECRET não configurado — assinatura não verificada.');
  }

  if (!config.mercadoPago.configured) {
    return res.sendStatus(200);
  }

  try {
    const payment = await mercadopago.getPayment(paymentId);
    if (payment.status === 'approved' && payment.external_reference) {
      const session = db.checkoutSessions.find((s) => s.id === payment.external_reference);
      if (session && session.status === 'pending') {
        await provisionAccount(session);
      }
    }
    return res.sendStatus(200);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Erro ao processar notificação do Mercado Pago:', err.message);
    // Responde 200 mesmo assim: erros já foram logados, e devolver erro faria o MP reenviar em looping.
    return res.sendStatus(200);
  }
});

module.exports = router;
