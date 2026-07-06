const db = require('./db');
const config = require('./config');
const password = require('./lib/password');
const { id } = require('./lib/id');

// Cria uma conta de teste só na primeira execução, para você conseguir logar e testar o
// dashboard sem passar pelo checkout. Ela NÃO aparece em nenhum lugar da interface — o
// e-mail/senha só existem aqui e nas variáveis de ambiente (SEED_DEMO_EMAIL/SEED_DEMO_PASSWORD).
// Troque-os antes de divulgar o site, ou desative com SEED_DEMO_ENABLED=false.
async function seedDemoData() {
  if (!config.demoAccount.enabled) return;
  const { email, password: demoPassword } = config.demoAccount;
  if (db.accounts.find((a) => a.email === email)) return;

  const passwordHash = await password.hash(demoPassword);
  const account = db.accounts.insert({
    id: id('acc'),
    businessName: 'Santa Madalena',
    ownerName: 'Conta Demo',
    email,
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

  // Só no log do servidor — nunca em resposta de API nem em HTML.
  // eslint-disable-next-line no-console
  console.log(`[seed] Conta de teste criada (não é exibida na interface): ${email} / ${demoPassword}`);
}

module.exports = { seedDemoData };
