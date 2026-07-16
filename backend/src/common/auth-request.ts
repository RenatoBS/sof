import type { Request } from 'express';
import {
  COOKIE_NAME,
  EMPLOYEE_COOKIE_NAME,
  verifyTokenPayload,
  type TokenPayload,
} from './token';

function readBearer(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    return bearer || null;
  }
  return null;
}

export function extractTokenPayload(
  req: Request,
  jwtSecret: string,
  cookieName: string,
): TokenPayload | null {
  const cookieToken = req.cookies?.[cookieName] as string | undefined;
  if (cookieToken) {
    const payload = verifyTokenPayload(cookieToken, jwtSecret);
    if (payload) return payload;
  }

  const bearer = readBearer(req);
  if (bearer) {
    return verifyTokenPayload(bearer, jwtSecret);
  }

  return null;
}

export function extractAccountIdFromRequest(
  req: Request,
  jwtSecret: string,
): string | null {
  const payload = extractTokenPayload(req, jwtSecret, COOKIE_NAME);
  if (!payload || payload.role !== 'account') return null;
  return payload.sub;
}

export function extractEmployeeAuthFromRequest(
  req: Request,
  jwtSecret: string,
): { employeeId: string; accountId: string } | null {
  const payload = extractTokenPayload(req, jwtSecret, EMPLOYEE_COOKIE_NAME);
  if (!payload || payload.role !== 'employee' || !payload.accountId) {
    return null;
  }
  return { employeeId: payload.sub, accountId: payload.accountId };
}
