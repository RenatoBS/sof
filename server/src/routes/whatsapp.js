const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const whatsapp = require('../lib/whatsapp');
const bot = require('../lib/whatsappBot');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const webhookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

// 1) Handshake de verificação exigido pela Meta ao cadastrar a URL do webhook.
// Configure em Meta for Developers > WhatsApp > Configuration, usando o mesmo WHATSAPP_VERIFY_TOKEN do .env.
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && config.whatsapp.verifyToken && verifyToken === config.whatsapp.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Recebimento das mensagens reais. A Meta envia o payload padrão do WhatsApp Cloud API:
// entry[].changes[].value.{ metadata.phone_number_id, messages[], contacts[] }
router.post('/webhook', webhookLimiter, async (req, res) => {
  const { valid, skipped } = whatsapp.verifySignature(req);
  if (!valid) {
    // eslint-disable-next-line no-console
    console.warn('[whatsapp] Assinatura inválida no webhook, ignorando payload.');
    return res.sendStatus(401);
  }
  if (skipped) {
    // eslint-disable-next-line no-console
    console.warn('[whatsapp] WHATSAPP_APP_SECRET não configurado — assinatura não verificada.');
  }

  // Responde 200 imediatamente (a Meta exige resposta rápida); processa em seguida.
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        const account = phoneNumberId
          ? db.accounts.find((a) => a.whatsappPhoneNumberId === phoneNumberId)
          : null;

        for (const message of value.messages || []) {
          if (message.type !== 'text' || !account) continue;
          const customerPhone = message.from;
          const text = message.text?.body || '';
          const { replies } = bot.handleIncomingMessage({ account, customerPhone, text });
          for (const reply of replies) {
            // eslint-disable-next-line no-await-in-loop
            await whatsapp.sendText(customerPhone, reply).catch((err) => {
              // eslint-disable-next-line no-console
              console.error('[whatsapp] Falha ao enviar resposta:', err.message);
            });
          }
        }
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[whatsapp] Erro processando webhook:', err);
  }
});

// 3) Simulador para testar o bot sem depender de credenciais reais da Meta — usado pelo botão
// "Simular WhatsApp" no dashboard. Roda exatamente a mesma máquina de estados do webhook real.
router.post('/simulate', requireAuth, express.json(), (req, res) => {
  const customerPhone = String(req.body?.customerPhone || '5511999990000').trim();
  const text = String(req.body?.message || '').trim();
  if (!text) return res.status(400).json({ error: 'Informe uma mensagem para simular.' });

  const result = bot.handleIncomingMessage({ account: req.account, customerPhone, text });
  res.json(result);
});

module.exports = router;
