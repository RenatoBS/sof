import { isValidPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('mantém só dígitos', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('5511987654321');
    expect(normalizePhone('11.98765.4321')).toBe('11987654321');
  });

  it('trata null/undefined/vazio', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('')).toBe('');
  });
});

describe('isValidPhone', () => {
  it('aceita 10–15 dígitos', () => {
    expect(isValidPhone('1198765432')).toBe(true);
    expect(isValidPhone('11987654321')).toBe(true);
    expect(isValidPhone('5511987654321')).toBe(true);
  });

  it('rejeita fora da faixa', () => {
    expect(isValidPhone('123456789')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});
