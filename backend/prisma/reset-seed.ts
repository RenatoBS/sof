/**
 * Apaga o conteúdo de todas as tabelas e roda o seed (SEED_DEMO_* do .env).
 *
 * Uso: npm run prisma:reset-seed  (no backend)
 *  ou: npm run backend:reset-seed (na raiz)
 */
import { config } from 'dotenv';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

// Sempre o .env do backend (mesmo rodando pela raiz via --prefix).
// override: true evita DATABASE_URL antiga exportada no shell.
config({ path: path.join(__dirname, '../.env'), override: true });

function assertDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    throw new Error('DATABASE_URL ausente no backend/.env');
  }
  try {
    const parsed = new URL(url);
    if (!parsed.port || Number.isNaN(Number(parsed.port))) {
      throw new Error(`porta inválida: "${parsed.port}"`);
    }
    console.log(
      `[reset-seed] Banco: ${parsed.hostname}:${parsed.port}${parsed.pathname}`,
    );
  } catch (err) {
    const hint =
      'Senha com +, & ou / precisa ser URL-encoded (%2B, %26, %2F). Ver docs/local-development.md.';
    throw new Error(
      `DATABASE_URL inválida (${err instanceof Error ? err.message : err}). ${hint}`,
    );
  }
}

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
  assertDatabaseUrl();

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
    cwd: path.join(__dirname, '..'),
  });

  console.log('[reset-seed] Concluído.');
}

main()
  .catch((err) => {
    console.error('[reset-seed] Falhou:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
