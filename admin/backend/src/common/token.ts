import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';

export const ADMIN_COOKIE_NAME = 'sof_admin_session';
export const EXPIRES_IN = '7d';

export type AdminTokenPayload = {
  sub: string;
  role: 'admin';
};

export function signAdminToken(adminId: string, jwtSecret: string) {
  return jwtSign(
    { sub: adminId, role: 'admin' } satisfies AdminTokenPayload,
    jwtSecret,
    { expiresIn: EXPIRES_IN },
  );
}

export function verifyAdminToken(
  token: string,
  jwtSecret: string,
): string | null {
  try {
    const payload = jwtVerify(token, jwtSecret) as Partial<AdminTokenPayload>;
    if (!payload.sub || payload.role !== 'admin') return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function cookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function extractAdminToken(req: {
  headers: { authorization?: string; cookie?: string };
  cookies?: Record<string, string>;
}): string | null {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const fromCookie = req.cookies?.[ADMIN_COOKIE_NAME];
  if (fromCookie) return fromCookie;
  return null;
}
