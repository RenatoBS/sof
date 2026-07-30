import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

const SALT_ROUNDS = 12;

export function hashPassword(plainText: string) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export function verifyPassword(plainText: string, hashed: string) {
  return bcrypt.compare(plainText, hashed);
}

export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(
      '',
    );
  return `${block()}-${block()}`;
}

export const PASSWORD_MIN_LENGTH = 8;

export function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= PASSWORD_MIN_LENGTH;
}
