const db = require('../db');
const token = require('../lib/token');

function requireAuth(req, res, next) {
  const raw = req.cookies?.[token.COOKIE_NAME];
  const accountId = raw && token.verify(raw);
  if (!accountId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) {
    return res.status(401).json({ error: 'Conta não encontrada.' });
  }
  req.account = account;
  next();
}

module.exports = { requireAuth };
