const db = require('../db');
const password = require('./password');
const { id } = require('./id');

// Cria a conta do assinante e liga o pagamento aprovado a ela.
// Usado tanto pelo modo demonstração (sem gateway configurado) quanto pelo webhook do Mercado Pago.
async function provisionAccount(session) {
  const existing = db.accounts.find((a) => a.email === session.email);
  if (existing) {
    db.checkoutSessions.update(session.id, { status: 'approved', accountId: existing.id, delivered: true });
    return { account: existing, tempPassword: null, alreadyExisted: true };
  }

  const tempPassword = password.generateTempPassword();
  const passwordHash = await password.hash(tempPassword);

  const account = db.accounts.insert({
    id: id('acc'),
    businessName: session.name,
    ownerName: session.name,
    email: session.email,
    passwordHash,
    plan: session.planName,
    planPrice: session.price,
    whatsappPhoneNumberId: '',
    createdAt: new Date().toISOString(),
    status: 'active',
  });

  db.checkoutSessions.update(session.id, {
    status: 'approved',
    accountId: account.id,
    tempPassword,
    delivered: false,
  });

  return { account, tempPassword, alreadyExisted: false };
}

module.exports = { provisionAccount };
