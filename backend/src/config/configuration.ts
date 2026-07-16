import { randomBytes } from 'crypto';

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function parseCorsOrigins(value: string | undefined): string[] {
  const raw =
    value ||
    process.env.PUBLIC_URL ||
    'http://localhost:5500,http://localhost:8081';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  let jwtSecret = process.env.JWT_SECRET || '';

  if (!jwtSecret) {
    if (isProd) {
      throw new Error(
        'JWT_SECRET precisa ser definido em produção. Configure a variável de ambiente.',
      );
    }
    console.warn(
      '[config] JWT_SECRET não definido — usando um segredo temporário só para desenvolvimento.',
    );
    jwtSecret = randomBytes(48).toString('hex');
  }

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    publicUrl: (process.env.PUBLIC_URL || 'http://localhost:8081').replace(
      /\/+$/,
      '',
    ),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    nodeEnv,
    isProd,
    jwtSecret,
    databaseUrl: process.env.DATABASE_URL || '',
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    whatsapp: {
      // meta | uazapi (Whazap usa a engine Uazapi)
      provider: (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase(),
      baseUrl: (process.env.WHATSAPP_BASE_URL || '').replace(/\/+$/, ''),
      token: process.env.WHATSAPP_TOKEN || '',
      // Meta: Phone Number ID · Uazapi/Whazap: Instance ID
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
      appSecret: process.env.WHATSAPP_APP_SECRET || '',
    },
    demoAccount: {
      enabled: bool(process.env.SEED_DEMO_ENABLED, true),
      email: process.env.SEED_DEMO_EMAIL || 'demo@sof.com',
      password: process.env.SEED_DEMO_PASSWORD || 'demo123',
    },
  };
};

export type AppConfig = ReturnType<typeof import('./configuration').default>;
