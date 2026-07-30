import { randomBytes } from 'crypto';

function parseCorsOrigins(value: string | undefined): string[] {
  const raw = value || process.env.PUBLIC_URL || 'http://localhost:8091';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  let jwtSecret =
    process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || '';

  if (!jwtSecret) {
    if (isProd) {
      throw new Error(
        'ADMIN_JWT_SECRET precisa ser definido em produção.',
      );
    }
    console.warn(
      '[config] ADMIN_JWT_SECRET não definido — usando segredo temporário.',
    );
    jwtSecret = randomBytes(48).toString('hex');
  }

  return {
    port: parseInt(process.env.PORT || '3011', 10),
    publicUrl: (process.env.PUBLIC_URL || 'http://localhost:8091').replace(
      /\/+$/,
      '',
    ),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    nodeEnv,
    isProd,
    jwtSecret,
    databaseUrl: process.env.DATABASE_URL || '',
    apiPublicUrl: (
      process.env.API_PUBLIC_URL || 'http://localhost:3001'
    ).replace(/\/+$/, ''),
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
    },
    whatsapp: {
      baseUrl: (process.env.WHATSAPP_BASE_URL || '').replace(/\/+$/, ''),
      adminToken: process.env.WHATSAPP_ADMIN_TOKEN || '',
      token: process.env.WHATSAPP_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    },
  };
};
