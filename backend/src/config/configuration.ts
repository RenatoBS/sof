import { randomBytes } from 'crypto';

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
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
    publicUrl: (process.env.PUBLIC_URL || 'http://localhost:5500').replace(
      /\/+$/,
      '',
    ),
    corsOrigin: (
      process.env.CORS_ORIGIN ||
      process.env.PUBLIC_URL ||
      'http://localhost:5500'
    ).replace(/\/+$/, ''),
    nodeEnv,
    isProd,
    jwtSecret,
    databaseUrl: process.env.DATABASE_URL || '',
    mercadoPago: {
      accessToken: process.env.MP_ACCESS_TOKEN || '',
      publicKey: process.env.MP_PUBLIC_KEY || '',
      webhookSecret: process.env.MP_WEBHOOK_SECRET || '',
    },
    whatsapp: {
      token: process.env.WHATSAPP_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
      appSecret: process.env.WHATSAPP_APP_SECRET || '',
    },
    demoAccount: {
      enabled: bool(process.env.SEED_DEMO_ENABLED, true),
      email: process.env.SEED_DEMO_EMAIL || 'demo@soft.com',
      password: process.env.SEED_DEMO_PASSWORD || 'demo123',
    },
  };
};

export type AppConfig = ReturnType<typeof import('./configuration').default>;
