import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

async function main() {
  if (!bool(process.env.SEED_DEMO_ENABLED, true)) return;

  const email = (process.env.SEED_DEMO_EMAIL || 'demo@soft.com').toLowerCase();
  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'demo123';

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const account = await prisma.account.create({
    data: {
      businessName: 'Santa Madalena',
      ownerName: 'Conta Demo',
      email,
      passwordHash,
      plan: 'Estúdio',
      planPrice: 197,
      whatsappPhoneNumberId: '',
      status: 'active',
    },
  });

  const employees = await Promise.all(
    [
      { name: 'Marcelo Silva', specialty: 'Cortes', phone: '11999990001', color: '#3b82f6' },
      { name: 'Bruno Costa', specialty: 'Barba', phone: '11999990002', color: '#10b981' },
      { name: 'Kaique Santos', specialty: 'Coloração', phone: '11999990003', color: '#f59e0b' },
    ].map((e) =>
      prisma.employee.create({
        data: { accountId: account.id, ...e },
      }),
    ),
  );

  const services = await Promise.all(
    [
      { name: 'Corte', duration: 45, price: 60 },
      { name: 'Barba', duration: 30, price: 40 },
      { name: 'Corte + Barba', duration: 70, price: 90 },
      { name: 'Coloração', duration: 90, price: 150 },
    ].map((s) =>
      prisma.service.create({
        data: { accountId: account.id, ...s },
      }),
    ),
  );

  const today = new Date().toISOString().split('T')[0];
  await prisma.appointment.create({
    data: {
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
    },
  });

  console.log(`[seed] Conta de teste criada (não é exibida na interface): ${email} / ${demoPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
