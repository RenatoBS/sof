import type { CookieOptions } from 'express';
import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';

export const COOKIE_NAME = 'sof_session';
export const EMPLOYEE_COOKIE_NAME = 'sof_employee_session';
export const EXPIRES_IN = '30d';

export type TokenRole = 'account' | 'employee';

export type TokenPayload = {
  sub: string;
  role: TokenRole;
  accountId?: string;
};

export function signAccountToken(accountId: string, jwtSecret: string) {
  return jwtSign(
    { sub: accountId, role: 'account' } satisfies TokenPayload,
    jwtSecret,
    { expiresIn: EXPIRES_IN },
  );
}

/** @deprecated use signAccountToken */
export function signToken(accountId: string, jwtSecret: string) {
  return signAccountToken(accountId, jwtSecret);
}

export function signEmployeeToken(
  employeeId: string,
  accountId: string,
  jwtSecret: string,
) {
  return jwtSign(
    {
      sub: employeeId,
      role: 'employee',
      accountId,
    } satisfies TokenPayload,
    jwtSecret,
    { expiresIn: EXPIRES_IN },
  );
}

export function verifyTokenPayload(
  token: string,
  jwtSecret: string,
): TokenPayload | null {
  try {
    const payload = jwtVerify(token, jwtSecret) as Partial<TokenPayload>;
    if (!payload.sub) return null;
    const role: TokenRole =
      payload.role === 'employee' ? 'employee' : 'account';
    return {
      sub: payload.sub,
      role,
      accountId: payload.accountId,
    };
  } catch {
    return null;
  }
}

/** Compat: retorna accountId só para tokens de conta. */
export function verifyToken(token: string, jwtSecret: string): string | null {
  const payload = verifyTokenPayload(token, jwtSecret);
  if (!payload || payload.role !== 'account') return null;
  return payload.sub;
}

/**
 * O tipo de retorno é explícito de propósito: sem ele o `sameSite` do ternário
 * vira `string` e não casa com o overload de `res.cookie`, quebrando o build.
 */
export function cookieOptions(isProd: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
