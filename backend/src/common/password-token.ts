import { createHash, randomBytes } from 'crypto';

/** TTL padrão dos links de redefinição / convite (2h). */
export const PASSWORD_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export function hashPasswordToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generatePasswordToken() {
  return randomBytes(32).toString('base64url');
}
