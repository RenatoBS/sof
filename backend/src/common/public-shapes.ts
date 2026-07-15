import { Account } from '@prisma/client';

export function publicAccount(account: Account | null) {
  if (!account) return null;
  const { passwordHash: _passwordHash, ...safe } = account;
  return {
    ...safe,
    createdAt: account.createdAt.toISOString(),
  };
}

export function serializeDates<T extends object>(record: T) {
  const out: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date) out[key] = value.toISOString();
  }
  return out;
}
