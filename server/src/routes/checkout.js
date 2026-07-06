const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { getPlan } = require('../lib/plans');
const { id } = require('../lib/id');
const mercadopago = require('../lib/mercadopago');
const { provisionAccount } = require('../lib/provisionAccount');
const token = require('../lib/token');

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Inicia uma assinatura: cria a "checkout session" e, se o Mercado Pago estiver configurado,
// devolve o link de pagamento (Checkout Pro). Sem credenciais configuradas, roda em modo
// demonstração e aprova na hora para você conseguir testar o fluxo completo.
router.post('/create', createLimiter, async (req, res) => {
  const planName = String(req.body?.planName || '').trim();
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();

  const plan = getPlan(planName);
  if (!plan) return res.status(400).json({ error: 'Plano inválido.' });
  if (!name) return res.status(400).json({ error: 'Informe o nome completo.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });

  if (db.accounts.find((a) => a.email === email)) {
    return res.status(409).json({ error: 'Este e-mail já tem uma conta. Faça login em vez de assinar de novo.' });
  }

  const session = db.checkoutSessions.insert({
    id: id('chk'),
    planName: plan.name,
    price: plan.price,
    name,
    email,
    status: 'pending',
    preferenceId: null,
    accountId: null,
    tempPassword: null,
    delivered: false,
    createdAt: new Date().toISOString(),
  });

  if (config.mercadoPago.configured) {
    try {
      const preference = await mercadopago.createPreference({
        sessionId: session.id,
        planName: plan.name,
        price: plan.price,
        payerEmail: email,
      });
      db.checkoutSessions.update(session.id, { preferenceId: preference.id });
      return res.json({
        mode: 'redirect',
        sessionId: session.id,
        initPoint: config.isProd ? preference.init_point : preference.sandbox_init_point || preference.init_point,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[checkout] Erro ao criar preferência no Mercado Pago:', err.message);
      return res.status(502).json({ error: 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.' });
    }
  }

  // Modo demonstração — sem gateway configurado, aprova direto para permitir testar o fluxo,
  // já autenticando o navegador (login automático) para simular a experiência pós-pagamento.
  const { account } = await provisionAccount(session);
  const jwtToken = token.sign(account.id);
  res.cookie(token.COOKIE_NAME, jwtToken, token.cookieOptions());
  return res.json({ mode: 'dev-approved', sessionId: session.id });
});

// A página de retorno do checkout (e o modal de demonstração) consulta este endpoint em polling
// até o pagamento ser confirmado pelo webhook, para então mostrar a senha de acesso uma única vez.
router.get('/status/:sessionId', (req, res) => {
  const session = db.checkoutSessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sessão de checkout não encontrada.' });

  if (session.status !== 'approved') {
    return res.json({ status: session.status });
  }

  if (session.delivered) {
    return res.json({ status: 'approved', email: session.email, delivered: true });
  }

  db.checkoutSessions.update(session.id, { delivered: true, tempPassword: null });
  return res.json({
    status: 'approved',
    email: session.email,
    tempPassword: session.tempPassword,
    delivered: false,
  });
});

module.exports = router;
