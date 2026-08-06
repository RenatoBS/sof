import {
  ACCOUNT_PASSWORD_MIN_LENGTH,
  generateTempPassword,
  hashPassword,
  isValidAccountPassword,
  verifyPassword,
} from './password';

describe('isValidAccountPassword', () => {
  it(`exige ao menos ${ACCOUNT_PASSWORD_MIN_LENGTH} caracteres`, () => {
    expect(isValidAccountPassword('1234567')).toBe(false);
    expect(isValidAccountPassword('12345678')).toBe(true);
    expect(isValidAccountPassword(null)).toBe(false);
    expect(isValidAccountPassword(12)).toBe(false);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('round-trip com bcrypt', async () => {
    const hash = await hashPassword('segredo-forte');
    expect(hash).not.toBe('segredo-forte');
    expect(await verifyPassword('segredo-forte', hash)).toBe(true);
    expect(await verifyPassword('outra', hash)).toBe(false);
  });
});

describe('generateTempPassword', () => {
  it('gera formato XXXX-XXXX sem caracteres ambíguos', () => {
    const temp = generateTempPassword();
    expect(temp).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(temp).not.toMatch(/[IO01]/);
  });
});
