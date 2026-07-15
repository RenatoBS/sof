import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';

export const COOKIE_NAME = 'sof_session';
export const EXPIRES_IN = '30d';

export function signToken(accountId: string, jwtSecret: string) {
  return jwtSign({ sub: accountId }, jwtSecret, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string, jwtSecret: string): string | null {
  try {
    const payload = jwtVerify(token, jwtSecret) as { sub?: string };
    return payload.sub || null;
  } catch {
    return null;
  }
}

export function cookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    // Cross-origin front/API em hosts diferentes (ex.: Heroku) exige None+Secure
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
