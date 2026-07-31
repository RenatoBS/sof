/** Espelha `saas/frontend/src/lib/validation.ts` e o `common/phone` do admin-api. */

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

/**
 * Máscara para telefone com DDI (pareamento WhatsApp): +55 (11) 99999-9999.
 * DDIs diferentes de 55 ficam sem agrupamento, só com o prefixo `+`.
 */
export function maskPhoneWithDdi(raw: string): string {
  const digits = normalizePhoneDigits(raw).slice(0, 15);
  if (!digits) return '';
  if (!digits.startsWith('55')) return `+${digits}`;
  const rest = digits.slice(2);
  if (!rest) return '+55';
  return `+55 ${maskBrPhone(rest)}`;
}

/** E-mail não tem máscara: só impede espaço e caixa alta, como o backend espera. */
export function maskEmail(raw: string): string {
  return String(raw || '')
    .replace(/\s/g, '')
    .toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhoneDigits(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15;
}
