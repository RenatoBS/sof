/** Regras alinhadas ao backend (`common/phone`, `common/password`, checkout). */

export const ACCOUNT_PASSWORD_MIN = 8;

export function normalizePhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhoneDigits(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidAccountPassword(value: string): boolean {
  return value.length >= ACCOUNT_PASSWORD_MIN;
}

/** HH:mm 00–23 / 00–59 */
export function isValidTimeHm(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

export type CheckoutFieldErrors = {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
};

export function validateCheckoutFields(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
}): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const phoneDigits = normalizePhoneDigits(input.phone);

  if (!name) {
    errors.name = 'Informe o nome completo.';
  }

  if (!phoneDigits) {
    errors.phone = 'Informe o telefone com DDD.';
  } else if (!isValidPhoneDigits(phoneDigits)) {
    errors.phone = 'Telefone inválido. Use DDD + número (10 a 15 dígitos).';
  }

  if (!email) {
    errors.email = 'Informe o e-mail.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Informe um e-mail válido.';
  }

  if (!input.password) {
    errors.password = 'Informe a senha.';
  } else if (!isValidAccountPassword(input.password)) {
    errors.password = `A senha deve ter pelo menos ${ACCOUNT_PASSWORD_MIN} caracteres.`;
  }

  return errors;
}

export function hasFieldErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}
