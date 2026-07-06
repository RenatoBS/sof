const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { publicAccount } = require('../lib/publicShapes');

const router = express.Router();

router.use(requireAuth);

// Painel "Conta": permite ligar o número de WhatsApp Business (phone_number_id da Meta) a esta
// conta, para que o webhook saiba em qual dashboard lançar os agendamentos confirmados pelo bot.
router.put('/', (req, res) => {
  const patch = {};
  if (typeof req.body?.businessName === 'string') {
    const businessName = req.body.businessName.trim();
    if (businessName) patch.businessName = businessName;
  }
  if (typeof req.body?.whatsappPhoneNumberId === 'string') {
    patch.whatsappPhoneNumberId = req.body.whatsappPhoneNumberId.trim();
  }
  const account = db.accounts.update(req.account.id, patch);
  res.json({ account: publicAccount(account) });
});

router.get('/integrations', (req, res) => {
  res.json({
    mercadoPago: { configured: config.mercadoPago.configured },
    whatsapp: {
      configured: config.whatsapp.configured,
      linkedPhoneNumberId: req.account.whatsappPhoneNumberId || '',
    },
  });
});

module.exports = router;
