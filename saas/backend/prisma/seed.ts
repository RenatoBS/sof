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
  // Desativa catálogo legado (Essencial / Estúdio) se ainda existir
  await prisma.plan.updateMany({
    where: { slug: { in: ['essencial', 'estudio'] } },
    data: { active: false },
  });

  const planEntries = Object.values(FALLBACK_PLANS);
  for (let i = 0; i < planEntries.length; i++) {
    const p = planEntries[i];
    const slug = slugifyPlanName(p.name);
    const existing = await prisma.plan.findUnique({ where: { slug } });
    if (!existing) {
      await prisma.plan.create({
        data: {
          name: p.name,
          slug,
          price: p.price,
          stripeProductId: `seed_${slug}`,
          stripePriceId: p.stripePriceId,
          paymentLinkUrl: p.paymentLinkUrl,
          features: p.features || [],
          entitlements: p.entitlements || {},
          active: true,
          sortOrder: i,
        },
      });
      continue;
    }
    // Não sobrescrever Product/Price/Payment Link já sincronizados na Stripe
    await prisma.plan.update({
      where: { slug },
      data: {
        name: p.name,
        price: p.price,
        features: p.features || [],
        entitlements: p.entitlements || {},
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

type DemoPlanSeed = {
  slug: 'solo' | 'equipe' | 'rede';
  email: string;
  businessName: string;
  ownerName: string;
  phone: string;
  address: string;
  /** Sufixo único nos e-mails dos profissionais (email é unique global). */
  employeeDomain: string;
  /** Prefixo de telefone dos profissionais (11 dígitos finais distintos). */
  employeePhoneBase: string;
  /** Prefixo de telefone dos clientes. */
  clientPhoneBase: string;
  /** Quantidade de profissionais (respeitar limite do plano). */
  employeeCount: number;
};

const DEMO_ACCOUNTS: DemoPlanSeed[] = [
  {
    slug: 'solo',
    email: 'demo-solo@sof.com',
    businessName: 'Barbearia Solo',
    ownerName: 'Demo Solo',
    phone: '11999990001',
    address: 'Rua Solo, 10 — São Paulo — SP',
    employeeDomain: 'solo.demo.sof',
    employeePhoneBase: '1198811',
    clientPhoneBase: '1199100',
    employeeCount: 2,
  },
  {
    slug: 'equipe',
    email: 'demo@sof.com',
    businessName: 'Santa Madalena',
    ownerName: 'Conta Demo',
    phone: '11999990000',
    address: 'Rua Santa Madalena, 120 — Vila Madalena, São Paulo — SP',
    employeeDomain: 'demo.sof',
    employeePhoneBase: '1198888',
    clientPhoneBase: '1199000',
    employeeCount: 3,
  },
  {
    slug: 'rede',
    email: 'demo-rede@sof.com',
    businessName: 'Rede Madalena',
    ownerName: 'Demo Rede',
    phone: '11999990002',
    address: 'Av. Rede, 500 — São Paulo — SP',
    employeeDomain: 'rede.demo.sof',
    employeePhoneBase: '1198822',
    clientPhoneBase: '1199200',
    employeeCount: 3,
  },
];

const EMPLOYEE_TEMPLATES = [
  {
    key: 'marcelo',
    name: 'Marcelo Silva',
    color: '#3b82f6',
    serviceKeys: ['corte', 'corteBarba'] as const,
  },
  {
    key: 'bruno',
    name: 'Bruno Costa',
    color: '#10b981',
    serviceKeys: ['barba', 'corteBarba'] as const,
  },
  {
    key: 'kaique',
    name: 'Kaique Santos',
    color: '#f59e0b',
    serviceKeys: ['coloracao'] as const,
  },
];

async function seedDemoAccount(
  demo: DemoPlanSeed,
  passwordHash: string,
  employeePasswordHash: string,
  demoPassword: string,
) {
  const existing = await prisma.account.findUnique({
    where: { email: demo.email },
  });
  if (existing) {
    console.log(`[seed] Conta já existe, pulando: ${demo.email}`);
    return;
  }

  const plan = await prisma.plan.findUnique({ where: { slug: demo.slug } });
  if (!plan) {
    console.warn(`[seed] Plano ${demo.slug} não encontrado — pulando ${demo.email}`);
    return;
  }

  const account = await prisma.account.create({
    data: {
      businessName: demo.businessName,
      ownerName: demo.ownerName,
      email: demo.email,
      phone: demo.phone,
      passwordHash,
      plan: plan.name,
      planPrice: plan.price,
      planId: plan.id,
      whatsappPhoneNumberId: '',
      openingHours: DEFAULT_OPENING_HOURS,
      address: demo.address,
      status: 'active',
    },
  });

  const serviceDefs = [
    { key: 'corte' as const, name: 'Corte', duration: 45, price: 60 },
    { key: 'barba' as const, name: 'Barba', duration: 30, price: 40 },
    { key: 'corteBarba' as const, name: 'Corte + Barba', duration: 70, price: 90 },
    { key: 'coloracao' as const, name: 'Coloração', duration: 90, price: 150 },
  ];
  const services: Record<
    string,
    { id: string; duration: number; price: number; name: string }
  > = {};
  for (const s of serviceDefs) {
    const row = await prisma.service.create({
      data: {
        accountId: account.id,
        name: s.name,
        duration: s.duration,
        price: s.price,
      },
    });
    services[s.key] = row;
  }

  await prisma.product.createMany({
    data: [
      {
        accountId: account.id,
        name: 'Pomada modeladora',
        description: 'Fixação média, acabamento natural. 100g.',
        price: 45,
        images: [],
        stock: 20,
        handoffEnabled: false,
        active: true,
      },
      {
        accountId: account.id,
        name: 'Kit presente',
        description: 'Shampoo + condicionador + óleo. Embalagem para presente.',
        price: 120,
        images: [],
        stock: null,
        handoffEnabled: true,
        active: true,
      },
    ],
  });

  const templates = EMPLOYEE_TEMPLATES.slice(0, demo.employeeCount);
  const employees = [];
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const emp = await prisma.employee.create({
      data: {
        accountId: account.id,
        name: t.name,
        email: `${t.key}@${demo.employeeDomain}`,
        phone: `${demo.employeePhoneBase}${String(1111 + i * 1111).slice(-4)}`,
        passwordHash: employeePasswordHash,
        mustChangePassword: true,
        color: t.color,
        services: {
          create: t.serviceKeys.map((k) => ({ serviceId: services[k].id })),
        },
      },
    });
    employees.push(emp);
  }

  const serviceByEmployee: Record<
    string,
    { id: string; duration: number; price: number; name: string }[]
  > = {};
  for (let i = 0; i < employees.length; i++) {
    const keys = templates[i].serviceKeys;
    serviceByEmployee[employees[i].id] = keys.map((k) => services[k]);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const openDays = nextOpenDays(today, 20);

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

    const weeklyTitle =
      emp.name.startsWith('Marcelo')
        ? 'Médico'
        : emp.name.startsWith('Bruno')
          ? 'Reunião'
          : 'Estoque';
    const weeklyGroup = randomUUID();
    const weeklyTime = emp.name.startsWith('Kaique') ? '18:00' : '13:30';
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

  const clients = [];
  for (let i = 0; i < CLIENT_NAMES.length; i++) {
    const client = await prisma.client.create({
      data: {
        accountId: account.id,
        name: CLIENT_NAMES[i],
        phone: `${demo.clientPhoneBase}${String(1000 + i).slice(-4)}`,
      },
    });
    clients.push(client);
  }

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
    const empServices = serviceByEmployee[employee.id];
    const primaryService = empServices[0];

    const withRecurrence = ci < 3;
    let created = 0;

    if (withRecurrence) {
      const groupId = randomUUID();
      const baseTime = SLOT_TIMES[ci % 4];
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
      const service = empServices[created % empServices.length];
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

  const firstEmpEmail = `${templates[0].key}@${demo.employeeDomain}`;
  console.log(
    `[seed] Conta ${plan.name}: ${demo.email} / ${demoPassword} (${clients.length} clientes, ${appointmentRows.length} agendamentos)`,
  );
  console.log(
    `[seed]   Profissional: ${firstEmpEmail} / ${demoPassword} (troca no 1º acesso)`,
  );
}

async function main() {
  await seedPlansAndAdmin();

  if (!bool(process.env.SEED_DEMO_ENABLED, true)) return;

  // Permite sobrescrever só o e-mail da conta Equipe (compatível com SEED_DEMO_EMAIL).
  const equipeOverride = (process.env.SEED_DEMO_EMAIL || '').trim().toLowerCase();
  if (equipeOverride) {
    const equipe = DEMO_ACCOUNTS.find((a) => a.slug === 'equipe');
    if (equipe) equipe.email = equipeOverride;
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'demo123';
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const employeePasswordHash = await bcrypt.hash(demoPassword, 12);

  for (const demo of DEMO_ACCOUNTS) {
    await seedDemoAccount(
      demo,
      passwordHash,
      employeePasswordHash,
      demoPassword,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
