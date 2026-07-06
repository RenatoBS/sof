const express = require('express');
const db = require('../db');
const { id } = require('../lib/id');
const { requireAuth } = require('../middleware/auth');
const realtime = require('../lib/realtime');

const router = express.Router();

router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function validatePayload(body, account) {
  const clientName = String(body?.clientName || '').trim();
  const date = String(body?.date || '');
  const time = String(body?.time || '');
  const employeeId = String(body?.employeeId || '');
  const serviceId = String(body?.serviceId || '');

  if (!clientName) return { error: 'Informe o nome do cliente.' };
  if (!DATE_RE.test(date)) return { error: 'Data inválida.' };
  if (!TIME_RE.test(time)) return { error: 'Horário inválido.' };

  const employee = db.employees.find((e) => e.id === employeeId && e.accountId === account.id);
  if (!employee) return { error: 'Profissional inválido.' };

  const service = db.services.find((s) => s.id === serviceId && s.accountId === account.id);
  if (!service) return { error: 'Serviço inválido.' };

  return {
    clientName,
    clientPhone: String(body?.clientPhone || '').trim(),
    date,
    time,
    employeeId,
    serviceId,
    price: service.price,
  };
}

router.get('/', (req, res) => {
  res.json({ appointments: db.appointments.filter((a) => a.accountId === req.account.id) });
});

router.post('/', (req, res) => {
  const parsed = validatePayload(req.body, req.account);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const appointment = db.appointments.insert({
    id: id('apt'),
    accountId: req.account.id,
    status: 'confirmed',
    source: 'manual',
    createdAt: new Date().toISOString(),
    ...parsed,
  });
  realtime.broadcast(req.account.id, 'appointment:created', { appointment });
  res.status(201).json({ appointment });
});

router.put('/:appointmentId', (req, res) => {
  const existing = db.appointments.find((a) => a.id === req.params.appointmentId && a.accountId === req.account.id);
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado.' });

  const parsed = validatePayload({ ...existing, ...req.body }, req.account);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const appointment = db.appointments.update(existing.id, parsed);
  realtime.broadcast(req.account.id, 'appointment:updated', { appointment });
  res.json({ appointment });
});

router.delete('/:appointmentId', (req, res) => {
  const existing = db.appointments.find((a) => a.id === req.params.appointmentId && a.accountId === req.account.id);
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado.' });
  db.appointments.remove(existing.id);
  realtime.broadcast(req.account.id, 'appointment:deleted', { appointmentId: existing.id });
  res.json({ ok: true });
});

module.exports = router;
