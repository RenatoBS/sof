/**
 * Apaga o conteúdo de todas as tabelas e roda o seed (SEED_DEMO_* do .env).
 *
 * Uso: npm run prisma:reset-seed  (no backend)
 *  ou: npm run backend:reset-seed (na raiz)
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearTables() {
  // Ordem: filhos → pais (FKs). Service tem Restrict em Appointment.
  await prisma.$transaction([
    prisma.appointment.deleteMany(),
    prisma.whatsappSession.deleteMany(),
    prisma.checkoutSession.deleteMany(),
    prisma.employeeService.deleteMany(),
    prisma.client.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.service.deleteMany(),
    prisma.account.deleteMany(),
  ]);
}

async function main() {
  const email = process.env.SEED_DEMO_EMAIL || 'demo@sof.com';
  console.log('[reset-seed] Limpando tabelas…');
  await clearTables();
  console.log('[reset-seed] Tabelas vazias. Rodando seed…');
  console.log(
    `[reset-seed] SEED_DEMO_ENABLED=${process.env.SEED_DEMO_ENABLED ?? 'true'} email=${email}`,
  );

  execSync('npx prisma db seed', {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
  });

  console.log('[reset-seed] Concluído.');
}

main()
  .catch((err) => {
    console.error('[reset-seed] Falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
