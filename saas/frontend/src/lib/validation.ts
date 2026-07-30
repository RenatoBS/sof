/** Regras alinhadas ao backend (`common/phone`, `common/password`, checkout). */

export const ACCOUNT_PASSWORD_MIN = 8;

export function normalizePhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

/** Máscara BR para input: (11) 99999-9999 / (11) 9999-9999. */
export function maskBrPhone(raw: string): string {
  let digits = normalizePhoneDigits(raw);
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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

export type ClientFieldErrors = {
  name?: string;
  phone?: string;
};

export function validateClientFields(input: {
  name: string;
  phone: string;
}): ClientFieldErrors {
  const errors: ClientFieldErrors = {};
  const name = input.name.trim();
  const phoneDigits = normalizePhoneDigits(input.phone);

  if (!name) errors.name = 'Informe o nome do cliente.';
  if (!phoneDigits) {
    errors.phone = 'Informe o telefone com DDD.';
  } else if (!isValidPhoneDigits(phoneDigits)) {
    errors.phone = 'Telefone inválido. Use DDD + número (10 a 15 dígitos).';
  }
  return errors;
}

export type EmployeeFieldErrors = {
  name?: string;
  phone?: string;
  email?: string;
  services?: string;
};

export function validateEmployeeFields(input: {
  name: string;
  phone: string;
  email: string;
  serviceIds: string[];
}): EmployeeFieldErrors {
  const errors: EmployeeFieldErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const phoneDigits = normalizePhoneDigits(input.phone);

  if (!name) errors.name = 'Informe o nome do profissional.';
  if (!phoneDigits) {
    errors.phone = 'Informe o telefone com DDD.';
  } else if (!isValidPhoneDigits(phoneDigits)) {
    errors.phone = 'Telefone inválido. Use DDD + número (10 a 15 dígitos).';
  }
  if (!email) {
    errors.email = 'Informe o e-mail de acesso.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Informe um e-mail válido.';
  }
  if (!input.serviceIds.length) {
    errors.services = 'Selecione ao menos um serviço.';
  }
  return errors;
}
