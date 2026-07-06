const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const password = require('../lib/password');
const token = require('../lib/token');
const { requireAuth } = require('../middleware/auth');
const { publicAccount } = require('../lib/publicShapes');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const plainPassword = String(req.body?.password || '');

  if (!isEmail(email) || !plainPassword) {
    return res.status(400).json({ error: 'Informe e-mail e senha válidos.' });
  }

  const account = db.accounts.find((a) => a.email === email);
  if (!account) {
    return res.status(401).json({ error: 'E-mail não encontrado.' });
  }

  const ok = await password.verify(plainPassword, account.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  const jwtToken = token.sign(account.id);
  res.cookie(token.COOKIE_NAME, jwtToken, token.cookieOptions());
  res.json({ account: publicAccount(account) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(token.COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ account: publicAccount(req.account) });
});

module.exports = router;
