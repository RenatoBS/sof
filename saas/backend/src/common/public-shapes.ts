import { Account, Employee } from '@prisma/client';
import { normalizeOpeningHours } from '../account/opening-hours';

export function publicAccount(account: Account | null) {
  if (!account) return null;
  const {
    passwordHash: _passwordHash,
    whatsappInstanceToken: _whatsappInstanceToken,
    ...safe
  } = account;
  const needsPlanSelection = account.status === 'paused';
  return {
    ...safe,
    openingHours: normalizeOpeningHours(account.openingHours),
    createdAt: account.createdAt.toISOString(),
    whatsappConnectedAt: account.whatsappConnectedAt
      ? account.whatsappConnectedAt.toISOString()
      : null,
    botPausedUntil: account.botPausedUntil
      ? account.botPausedUntil.toISOString()
      : null,
    promoExpiresAt: account.promoExpiresAt
      ? account.promoExpiresAt.toISOString()
      : null,
    needsPlanSelection,
  };
}

export function publicEmployeeSession(
  employee: Employee,
  account: Pick<Account, 'id' | 'businessName' | 'logoBase64'>,
) {
  return {
    id: employee.id,
    accountId: employee.accountId,
    name: employee.name,
    email: employee.email || '',
    phone: employee.phone || '',
    color: employee.color,
    mustChangePassword: employee.mustChangePassword,
    businessName: account.businessName,
    logoBase64: account.logoBase64 || '',
    createdAt: employee.createdAt.toISOString(),
  };
}

export function serializeDates<T extends object>(record: T) {
  const out: Record<string, unknown> = {
    ...(record as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date) out[key] = value.toISOString();
  }
  return out;
}
