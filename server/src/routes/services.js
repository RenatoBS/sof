const express = require('express');
const db = require('../db');
const { id } = require('../lib/id');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ services: db.services.filter((s) => s.accountId === req.account.id) });
});

router.post('/', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const duration = parseInt(req.body?.duration, 10);
  const price = parseFloat(req.body?.price);

  if (!name) return res.status(400).json({ error: 'Informe o nome do serviço.' });
  if (!Number.isFinite(duration) || duration <= 0) return res.status(400).json({ error: 'Duração inválida.' });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Preço inválido.' });

  const service = db.services.insert({
    id: id('srv'),
    accountId: req.account.id,
    name,
    duration,
    price,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ service });
});

router.delete('/:serviceId', (req, res) => {
  const service = db.services.find((s) => s.id === req.params.serviceId && s.accountId === req.account.id);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });
  db.services.remove(service.id);
  res.json({ ok: true });
});

module.exports = router;
