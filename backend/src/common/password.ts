import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';

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
