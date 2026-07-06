const db = require('./db');
const password = require('./lib/password');
const { id } = require('./lib/id');

const DEMO_EMAIL = 'demo@soft.com';
const DEMO_PASSWORD = 'demo123';

// Cria uma conta de demonstração (visível na tela de login) só na primeira execução,
// para dar pra testar o dashboard sem precisar passar pelo checkout.
async function seedDemoData() {
  if (db.accounts.find((a) => a.email === DEMO_EMAIL)) return;

  const passwordHash = await password.hash(DEMO_PASSWORD);
  const account = db.accounts.insert({
    id: id('acc'),
    businessName: 'Santa Madalena',
    ownerName: 'Conta Demo',
    email: DEMO_EMAIL,
    passwordHash,
    plan: 'Estúdio',
    planPrice: 197,
    whatsappPhoneNumberId: '',
    createdAt: new Date().toISOString(),
    status: 'active',
  });

  const employees = [
    { name: 'Marcelo Silva', specialty: 'Cortes', phone: '11999990001', color: '#3b82f6' },
    { name: 'Bruno Costa', specialty: 'Barba', phone: '11999990002', color: '#10b981' },
    { name: 'Kaique Santos', specialty: 'Coloração', phone: '11999990003', color: '#f59e0b' },
  ].map((e) => db.employees.insert({ id: id('emp'), accountId: account.id, createdAt: new Date().toISOString(), ...e }));

  const services = [
    { name: 'Corte', duration: 45, price: 60 },
    { name: 'Barba', duration: 30, price: 40 },
    { name: 'Corte + Barba', duration: 70, price: 90 },
    { name: 'Coloração', duration: 90, price: 150 },
  ].map((s) => db.services.insert({ id: id('srv'), accountId: account.id, createdAt: new Date().toISOString(), ...s }));

  const today = new Date().toISOString().split('T')[0];
  db.appointments.insert({
    id: id('apt'),
    accountId: account.id,
    employeeId: employees[0].id,
    serviceId: services[2].id,
    clientName: 'Cliente Exemplo',
    clientPhone: '11988887777',
    date: today,
    time: '15:00',
    price: services[2].price,
    status: 'confirmed',
    source: 'manual',
    createdAt: new Date().toISOString(),
  });

  // eslint-disable-next-line no-console
  console.log(`[seed] Conta demo criada: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

module.exports = { seedDemoData };
