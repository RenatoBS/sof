const express = require('express');
const { requireAuth } = require('../middleware/auth');
const realtime = require('../lib/realtime');

const router = express.Router();

// Canal de eventos em tempo real do dashboard (Server-Sent Events). O front-end abre uma conexão
// aqui e recebe um evento "appointment:created" assim que o bot do WhatsApp confirma um horário.
router.get('/stream', requireAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  res.write('retry: 3000\n\n');

  realtime.subscribe(req.account.id, res);

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    realtime.unsubscribe(req.account.id, res);
  });
});

module.exports = router;
