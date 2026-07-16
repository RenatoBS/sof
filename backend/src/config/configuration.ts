import { randomBytes } from 'crypto';

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
    apiPublicUrl: (
      process.env.API_PUBLIC_URL ||
      `http://localhost:${process.env.PORT || '3001'}`
    ).replace(/\/+$/, ''),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    nodeEnv,
    isProd,
    jwtSecret,
    databaseUrl: process.env.DATABASE_URL || '',
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    whatsapp: {
      // uazapi (default) | meta (Cloud API)
      provider: (process.env.WHATSAPP_PROVIDER || 'uazapi').toLowerCase(),
      baseUrl: (process.env.WHATSAPP_BASE_URL || '').replace(/\/+$/, ''),
      /** Admin token Uazapi — cria instâncias por conta */
      adminToken: process.env.WHATSAPP_ADMIN_TOKEN || '',
      /** Fallback legado (instância única) / Meta access token */
      token: process.env.WHATSAPP_TOKEN || '',
      // Meta: Phone Number ID · Uazapi legado: Instance ID
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      /** Só Meta Cloud API (verificação do webhook GET) */
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
      /** Só Meta Cloud API (assinatura X-Hub-Signature-256) */
      appSecret: process.env.WHATSAPP_APP_SECRET || '',
    },
  };
};

export type AppConfig = ReturnType<typeof import('./configuration').default>;
