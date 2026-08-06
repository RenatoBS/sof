/** Limites de throttle — mais folgados fora de produção (suíte E2E local). */
const isProd = process.env.NODE_ENV === 'production';

export const LOGIN_THROTTLE = {
  default: {
    limit: isProd ? 20 : 300,
    ttl: 15 * 60 * 1000,
  },
} as const;

export const PASSWORD_RESET_THROTTLE = {
  default: {
    limit: isProd ? 8 : 60,
    ttl: 15 * 60 * 1000,
  },
} as const;
