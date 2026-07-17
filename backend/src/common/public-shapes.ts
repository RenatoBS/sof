import { Account, Employee } from '@prisma/client';
import { normalizeOpeningHours } from '../account/opening-hours';

export function publicAccount(account: Account | null) {
  if (!account) return null;
  const {
    passwordHash: _passwordHash,
    whatsappInstanceToken: _whatsappInstanceToken,
    ...safe
  } = account;
  return {
    ...safe,
    openingHours: normalizeOpeningHours(account.openingHours),
    createdAt: account.createdAt.toISOString(),
    whatsappConnectedAt: account.whatsappConnectedAt
      ? account.whatsappConnectedAt.toISOString()
      : null,
  };
}

export function publicEmployeeSession(
  employee: Employee,
  account: Pick<Account, 'id' | 'businessName'>,
) {
  return {
    id: employee.id,
    accountId: employee.accountId,
    name: employee.name,
    email: employee.email || '',
    color: employee.color,
    mustChangePassword: employee.mustChangePassword,
    businessName: account.businessName,
    createdAt: employee.createdAt.toISOString(),
  };
}

export function serializeDates<T extends object>(record: T) {
  const out: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date) out[key] = value.toISOString();
  }
  return out;
}
