import {
  ACCOUNT_PASSWORD_MIN,
  hasFieldErrors,
  isValidAccountPassword,
  isValidEmail,
  isValidPhoneDigits,
  isValidTimeHm,
  maskBrPhone,
  maskEmail,
  maskPhoneWithDdi,
  normalizePhoneDigits,
  validateCheckoutFields,
  validateClientFields,
  validateEmployeeFields,
} from '../validation';

describe('normalizePhoneDigits / masks', () => {
  it('normaliza e mascara telefone BR', () => {
    expect(normalizePhoneDigits('(11) 98765-4321')).toBe('11987654321');
    expect(maskBrPhone('11987654321')).toBe('(11) 98765-4321');
    expect(maskBrPhone('5511987654321')).toBe('(11) 98765-4321');
  });

  it('máscara com DDI', () => {
    expect(maskPhoneWithDdi('5511987654321')).toBe('+55 (11) 98765-4321');
    expect(maskPhoneWithDdi('1')).toBe('+1');
  });

  it('máscara e-mail', () => {
    expect(maskEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
});

describe('validators', () => {
  it('isValidEmail / phone / password / time', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('x')).toBe(false);
    expect(isValidPhoneDigits('11987654321')).toBe(true);
    expect(isValidPhoneDigits('123')).toBe(false);
    expect(isValidAccountPassword('12345678')).toBe(true);
    expect(isValidAccountPassword('1234567')).toBe(false);
    expect(ACCOUNT_PASSWORD_MIN).toBe(8);
    expect(isValidTimeHm('09:30')).toBe(true);
    expect(isValidTimeHm('24:00')).toBe(false);
  });
});

describe('validateCheckoutFields', () => {
  it('ok quando campos válidos', () => {
    const errors = validateCheckoutFields({
      name: 'Ana Silva',
      phone: '11987654321',
      email: 'ana@sof.com',
      password: 'senha123',
    });
    expect(hasFieldErrors(errors)).toBe(false);
  });

  it('acumula erros', () => {
    const errors = validateCheckoutFields({
      name: ' ',
      phone: '12',
      email: 'x',
      password: 'curta',
    });
    expect(errors.name).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });
});

describe('validateClientFields / validateEmployeeFields', () => {
  it('cliente exige nome e telefone', () => {
    expect(
      validateClientFields({ name: '', phone: '' }).name,
    ).toBeTruthy();
    expect(
      hasFieldErrors(
        validateClientFields({ name: 'Maria', phone: '11999998888' }),
      ),
    ).toBe(false);
  });

  it('profissional exige serviços', () => {
    const errors = validateEmployeeFields({
      name: 'João',
      phone: '11999998888',
      email: 'joao@demo.sof',
      serviceIds: [],
    });
    expect(errors.services).toBeTruthy();
  });
});
