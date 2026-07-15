import type { Request } from 'express';
import { COOKIE_NAME, verifyToken } from './token';

export function extractAccountIdFromRequest(
  req: Request,
  jwtSecret: string,
): string | null {
  const cookieToken = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (cookieToken) {
    const accountId = verifyToken(cookieToken, jwtSecret);
    if (accountId) return accountId;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) {
      const accountId = verifyToken(bearer, jwtSecret);
      if (accountId) return accountId;
    }
  }

  return null;
}
