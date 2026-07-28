import type { EntitlementsMap } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthProvider';

export function hasFeature(
  ents: EntitlementsMap | undefined | null,
  key: string,
): boolean {
  if (!ents) return false;
  const v = ents[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null) return true;
  return false;
}

export function limitValue(
  ents: EntitlementsMap | undefined | null,
  key: string,
): number | null {
  if (!ents) return 0;
  const v = ents[key];
  if (v === null) return null;
  if (typeof v === 'number') return v;
  return 0;
}

export function useEntitlements() {
  const { account } = useAuth();
  const entitlements = account?.entitlements;
  return {
    entitlements,
    has: (key: string) => hasFeature(entitlements, key),
    limit: (key: string) => limitValue(entitlements, key),
  };
}
