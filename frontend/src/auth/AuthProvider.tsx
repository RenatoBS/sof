import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Account } from '@/src/api/types';
import { authApi } from '@/src/api/endpoints';
import { setToken, getToken, setEmployeeToken } from '@/src/auth/tokenStorage';

type AuthContextValue = {
  account: Account | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<boolean>;
  setSession: (account: Account, token?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback(async (acc: Account, token?: string) => {
    if (token) await setToken(token);
    setAccount(acc);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { account: me } = await authApi.me();
      setAccount(me);
      return true;
    } catch {
      await setToken(null);
      setAccount(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { account: acc, token } = await authApi.login(email, password);
      await setEmployeeToken(null);
      await setSession(acc, token);
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      await setToken(null);
      setAccount(null);
    }
  }, []);

  const value = useMemo(
    () => ({ account, loading, login, logout, refreshMe, setSession }),
    [account, loading, login, logout, refreshMe, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
