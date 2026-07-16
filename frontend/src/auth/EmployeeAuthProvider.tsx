import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { EmployeeSession } from '@/src/api/types';
import { employeeAuthApi } from '@/src/api/endpoints';
import {
  setEmployeeToken,
  getEmployeeToken,
  setToken,
} from '@/src/auth/tokenStorage';

type EmployeeAuthContextValue = {
  employee: EmployeeSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<EmployeeSession>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<boolean>;
  setEmployeeSession: (
    employee: EmployeeSession,
    token?: string,
  ) => Promise<void>;
};

const EmployeeAuthContext = createContext<EmployeeAuthContextValue | null>(
  null,
);

export function EmployeeAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [loading, setLoading] = useState(true);

  const setEmployeeSession = useCallback(
    async (emp: EmployeeSession, token?: string) => {
      if (token) await setEmployeeToken(token);
      setEmployee(emp);
    },
    [],
  );

  const refreshMe = useCallback(async () => {
    try {
      const token = await getEmployeeToken();
      if (!token) {
        setEmployee(null);
        return false;
      }
      const { employee: me } = await employeeAuthApi.me();
      setEmployee(me);
      return true;
    } catch {
      await setEmployeeToken(null);
      setEmployee(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { employee: emp, token } = await employeeAuthApi.login(
        email,
        password,
      );
      await setToken(null);
      await setEmployeeSession(emp, token);
      return emp;
    },
    [setEmployeeSession],
  );

  const logout = useCallback(async () => {
    try {
      await employeeAuthApi.logout();
    } finally {
      await setEmployeeToken(null);
      setEmployee(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      employee,
      loading,
      login,
      logout,
      refreshMe,
      setEmployeeSession,
    }),
    [employee, loading, login, logout, refreshMe, setEmployeeSession],
  );

  return (
    <EmployeeAuthContext.Provider value={value}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const ctx = useContext(EmployeeAuthContext);
  if (!ctx) {
    throw new Error('useEmployeeAuth must be used within EmployeeAuthProvider');
  }
  return ctx;
}
