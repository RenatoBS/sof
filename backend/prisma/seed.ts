import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

async function main() {
  if (!bool(process.env.SEED_DEMO_ENABLED, true)) return;

  const email = (process.env.SEED_DEMO_EMAIL || 'demo@sof.com').toLowerCase();
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

  const [corte, barba, corteBarba, coloracao] = await Promise.all(
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

  const marcelo = await prisma.employee.create({
    data: {
      accountId: account.id,
      name: 'Marcelo Silva',
      color: '#3b82f6',
      services: {
        create: [{ serviceId: corte.id }, { serviceId: corteBarba.id }],
      },
    },
  });
  await prisma.employee.create({
    data: {
      accountId: account.id,
      name: 'Bruno Costa',
      color: '#10b981',
      services: {
        create: [{ serviceId: barba.id }, { serviceId: corteBarba.id }],
      },
    },
  });
  await prisma.employee.create({
    data: {
      accountId: account.id,
      name: 'Kaique Santos',
      color: '#f59e0b',
      services: {
        create: [{ serviceId: coloracao.id }],
      },
    },
  });

  const today = new Date().toISOString().split('T')[0];
  await prisma.appointment.create({
    data: {
      accountId: account.id,
      employeeId: marcelo.id,
      serviceId: corteBarba.id,
      clientName: 'Cliente Exemplo',
      clientPhone: '11988887777',
      date: today,
      time: '15:00',
      price: corteBarba.price,
      status: 'confirmed',
      source: 'manual',
    },
  });

  console.log(
    `[seed] Conta de teste criada (não é exibida na interface): ${email} / ${demoPassword}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
