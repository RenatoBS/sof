import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_OPENING_HOURS } from '../src/account/opening-hours';
import {
  FALLBACK_PLANS,
  slugifyPlanName,
} from '../src/common/plans';

const prisma = new PrismaClient();

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

async function seedPlansAndAdmin() {
  const planEntries = Object.values(FALLBACK_PLANS);
  for (let i = 0; i < planEntries.length; i++) {
    const p = planEntries[i];
    const slug = slugifyPlanName(p.name);
    await prisma.plan.upsert({
      where: { slug },
      create: {
        name: p.name,
        slug,
        price: p.price,
        stripeProductId: `seed_${slug}`,
        stripePriceId: p.stripePriceId,
        paymentLinkUrl: p.paymentLinkUrl,
        features: p.features || [],
        active: true,
        sortOrder: i,
      },
      update: {
        name: p.name,
        price: p.price,
        stripePriceId: p.stripePriceId,
        paymentLinkUrl: p.paymentLinkUrl,
        features: p.features || [],
        active: true,
        sortOrder: i,
      },
    });
  }
  console.log(`[seed] ${planEntries.length} planos no catálogo.`);

  if (!bool(process.env.SEED_ADMIN_ENABLED, true)) return;

  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL || 'admin@sof.com'
  ).toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });
  if (existingAdmin) {
    console.log(`[seed] Admin já existe: ${adminEmail}`);
    return;
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.adminUser.create({
    data: {
      email: adminEmail,
      name: 'Admin Sof',
      passwordHash,
    },
  });
  console.log(`[seed] Admin criado: ${adminEmail} / ${adminPassword}`);
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function localDateStr(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return d;
}

/** Próximos `count` dias úteis (seg–sáb) a partir de hoje. */
function nextOpenDays(from: Date, count: number) {
  const days: Date[] = [];
  let offset = 0;
  while (days.length < count) {
    const d = addDays(from, offset);
    offset += 1;
    if (d.getDay() === 0) continue; // domingo fechado no default
    days.push(d);
  }
  return days;
}

const CLIENT_NAMES = [
  'Ana Souza',
  'Bruno Lima',
  'Carla Mendes',
  'Diego Alves',
  'Elena Rocha',
  'Fábio Nunes',
  'Gabriela Dias',
  'Hugo Martins',
  'Isabela Freitas',
  'João Pedro',
];

const SLOT_TIMES = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
];

async function main() {
  await seedPlansAndAdmin();

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
      phone: '11999990000',
      passwordHash,
      plan: 'Estúdio',
      planPrice: 197,
      whatsappPhoneNumberId: '',
      openingHours: DEFAULT_OPENING_HOURS,
      address: 'Rua Santa Madalena, 120 — Vila Madalena, São Paulo — SP',
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

  const employeePassword = demoPassword;
  const employeePasswordHash = await bcrypt.hash(employeePassword, 12);

  const marcelo = await prisma.employee.create({
    data: {
      accountId: account.id,
      name: 'Marcelo Silva',
      email: 'marcelo@demo.sof',
      phone: '11988881111',
      passwordHash: employeePasswordHash,
      mustChangePassword: true,
      color: '#3b82f6',
      services: {
        create: [{ serviceId: corte.id }, { serviceId: corteBarba.id }],
      },
    },
  });
  const bruno = await prisma.employee.create({
    data: {
      accountId: account.id,
      name: 'Bruno Costa',
      email: 'bruno@demo.sof',
      phone: '11988882222',
      passwordHash: employeePasswordHash,
      mustChangePassword: true,
      color: '#10b981',
      services: {
        create: [{ serviceId: barba.id }, { serviceId: corteBarba.id }],
      },
    },
  });
  const kaique = await prisma.employee.create({
    data: {
      accountId: account.id,
      name: 'Kaique Santos',
      email: 'kaique@demo.sof',
      phone: '11988883333',
      passwordHash: employeePasswordHash,
      mustChangePassword: true,
      color: '#f59e0b',
      services: {
        create: [{ serviceId: coloracao.id }],
      },
    },
  });

  const employees = [marcelo, bruno, kaique];
  const serviceByEmployee: Record<
    string,
    { id: string; duration: number; price: number; name: string }[]
  > = {
    [marcelo.id]: [corte, corteBarba],
    [bruno.id]: [barba, corteBarba],
    [kaique.id]: [coloracao],
  };

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const openDays = nextOpenDays(today, 20);

  // —— Bloqueios fixos dos profissionais (almoço + outros) ——
  const blockRows: {
    accountId: string;
    employeeId: string;
    kind: string;
    title: string;
    durationMinutes: number;
    date: string;
    time: string;
    price: number;
    status: string;
    source: string;
    recurrenceGroupId: string | null;
  }[] = [];

  for (const emp of employees) {
    const lunchGroup = randomUUID();
    // Almoço 12:00 (60 min) nos próximos 10 dias úteis — série recorrente
    for (let i = 0; i < 10; i++) {
      const day = openDays[i];
      if (day.getDay() === 0) continue;
      blockRows.push({
        accountId: account.id,
        employeeId: emp.id,
        kind: 'block',
        title: 'Almoço',
        durationMinutes: 60,
        date: localDateStr(day),
        time: '12:00',
        price: 0,
        status: 'scheduled',
        source: 'manual',
        recurrenceGroupId: lunchGroup,
      });
    }

    // Compromisso fixo semanal (ex.: médico / reunião) — 4 ocorrências
    const weeklyTitle =
      emp.id === marcelo.id
        ? 'Médico'
        : emp.id === bruno.id
          ? 'Reunião'
          : 'Estoque';
    const weeklyGroup = randomUUID();
    const weeklyTime = emp.id === kaique.id ? '18:00' : '13:30';
    const weeklyDays = openDays.filter((_, i) => i % 5 === 0).slice(0, 4);
    for (const day of weeklyDays) {
      blockRows.push({
        accountId: account.id,
        employeeId: emp.id,
        kind: 'block',
        title: weeklyTitle,
        durationMinutes: 45,
        date: localDateStr(day),
        time: weeklyTime,
        price: 0,
        status: 'scheduled',
        source: 'manual',
        recurrenceGroupId: weeklyGroup,
      });
    }
  }

  await prisma.appointment.createMany({ data: blockRows });

  // —— 10 clientes ——
  const clients = [];
  for (let i = 0; i < CLIENT_NAMES.length; i++) {
    const client = await prisma.client.create({
      data: {
        accountId: account.id,
        name: CLIENT_NAMES[i],
        phone: `1199000${String(1000 + i).slice(-4)}`,
      },
    });
    clients.push(client);
  }

  // —— 10 agendamentos por cliente (alguns com recorrência semanal) ——
  const appointmentRows: {
    accountId: string;
    employeeId: string;
    kind: string;
    title: string;
    durationMinutes: number;
    serviceId: string;
    clientId: string;
    clientName: string;
    clientPhone: string;
    date: string;
    time: string;
    price: number;
    status: string;
    source: string;
    recurrenceGroupId: string | null;
  }[] = [];

  // Evita overlap grosseiro: chave employeeId|date|time
  const usedSlots = new Set<string>();
  for (const b of blockRows) {
    usedSlots.add(`${b.employeeId}|${b.date}|${b.time}`);
  }

  function takeSlot(
    employeeId: string,
    date: string,
    preferredTimes: string[],
  ): string | null {
    for (const time of preferredTimes) {
      const key = `${employeeId}|${date}|${time}`;
      if (!usedSlots.has(key)) {
        usedSlots.add(key);
        return time;
      }
    }
    return null;
  }

  for (let ci = 0; ci < clients.length; ci++) {
    const client = clients[ci];
    const employee = employees[ci % employees.length];
    const services = serviceByEmployee[employee.id];
    const primaryService = services[0];

    // Clientes 0–2: série semanal recorrente (4 ocorrências) + 6 avulsos
    // Demais: 10 avulsos
    const withRecurrence = ci < 3;
    let created = 0;

    if (withRecurrence) {
      const groupId = randomUUID();
      const baseTime = SLOT_TIMES[ci % 4]; // 09:00, 09:30, 10:00
      const weeklyDays = openDays.filter((_, i) => i % 5 === 0).slice(0, 4);
      for (const day of weeklyDays) {
        const date = localDateStr(day);
        const time =
          takeSlot(employee.id, date, [
            baseTime,
            ...SLOT_TIMES.filter((t) => t !== baseTime),
          ]) || baseTime;
        usedSlots.add(`${employee.id}|${date}|${time}`);
        appointmentRows.push({
          accountId: account.id,
          employeeId: employee.id,
          kind: 'service',
          title: '',
          durationMinutes: primaryService.duration,
          serviceId: primaryService.id,
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          date,
          time,
          price: primaryService.price,
          status: 'scheduled',
          source: ci % 2 === 0 ? 'manual' : 'whatsapp',
          recurrenceGroupId: groupId,
        });
        created += 1;
      }
    }

    let dayIdx = withRecurrence ? 1 : 0;
    while (created < 10) {
      const day = openDays[dayIdx % openDays.length];
      dayIdx += 1;
      const date = localDateStr(day);
      const service = services[created % services.length];
      const preferred = [
        SLOT_TIMES[(ci * 3 + created) % SLOT_TIMES.length],
        ...SLOT_TIMES,
      ];
      const time = takeSlot(employee.id, date, preferred);
      if (!time) continue;

      appointmentRows.push({
        accountId: account.id,
        employeeId: employee.id,
        kind: 'service',
        title: '',
        durationMinutes: service.duration,
        serviceId: service.id,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        date,
        time,
        price: service.price,
        status: 'scheduled',
        source: created % 3 === 0 ? 'whatsapp' : 'manual',
        recurrenceGroupId: null,
      });
      created += 1;
    }
  }

  await prisma.appointment.createMany({ data: appointmentRows });

  console.log(
    `[seed] Conta de teste criada (não é exibida na interface): ${email} / ${demoPassword}`,
  );
  console.log(
    `[seed] Login profissional (ex.): marcelo@demo.sof / ${employeePassword} (troca de senha no 1º acesso)`,
  );
  console.log(
    `[seed] ${clients.length} clientes, ${appointmentRows.length} agendamentos de serviço, ${blockRows.length} bloqueios (almoço/recorrentes).`,
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
