/** Keep digits only (E.164 without +). */
export function normalizePhone(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

export function isValidPhone(phone: string): boolean {
  return phone.length >= 10 && phone.length <= 15;
}
