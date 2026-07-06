require('dotenv').config();

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  jwtSecret: process.env.JWT_SECRET || '',

  mercadoPago: {
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    publicKey: process.env.MP_PUBLIC_KEY || '',
    webhookSecret: process.env.MP_WEBHOOK_SECRET || '',
    get configured() {
      return Boolean(config.mercadoPago.accessToken);
    },
  },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    get configured() {
      return Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
    },
  },

  // Conta de teste criada em silêncio no primeiro start, sem aparecer em lugar nenhum da
  // interface — só existe pra você logar e testar. Troque o e-mail/senha via env antes de
  // divulgar o site (veja .env.example) e, se quiser, desative de vez com SEED_DEMO_ENABLED=false.
  demoAccount: {
    enabled: bool(process.env.SEED_DEMO_ENABLED, true),
    email: process.env.SEED_DEMO_EMAIL || 'demo@soft.com',
    password: process.env.SEED_DEMO_PASSWORD || 'demo123',
  },
};

if (!config.jwtSecret) {
  if (config.isProd) {
    throw new Error('JWT_SECRET precisa ser definido em produção. Configure a variável de ambiente.');
  }
  // eslint-disable-next-line no-console
  console.warn('[config] JWT_SECRET não definido — usando um segredo temporário só para desenvolvimento.');
  config.jwtSecret = require('crypto').randomBytes(48).toString('hex');
}

module.exports = config;
