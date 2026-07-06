const express = require('express');
const db = require('../db');
const { id } = require('../lib/id');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ employees: db.employees.filter((e) => e.accountId === req.account.id) });
});

router.post('/', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const specialty = String(req.body?.specialty || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!name) return res.status(400).json({ error: 'Informe o nome do profissional.' });

  const count = db.employees.filter((e) => e.accountId === req.account.id).length;
  const employee = db.employees.insert({
    id: id('emp'),
    accountId: req.account.id,
    name,
    specialty,
    phone,
    color: COLORS[count % COLORS.length],
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ employee });
});

router.delete('/:employeeId', (req, res) => {
  const employee = db.employees.find((e) => e.id === req.params.employeeId && e.accountId === req.account.id);
  if (!employee) return res.status(404).json({ error: 'Profissional não encontrado.' });
  db.employees.remove(employee.id);
  db.appointments
    .filter((a) => a.employeeId === employee.id && a.accountId === req.account.id)
    .forEach((a) => db.appointments.remove(a.id));
  res.json({ ok: true });
});

module.exports = router;
