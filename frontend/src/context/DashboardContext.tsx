import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Appointment, Employee, Service } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';

type DashboardContextValue = {
  employees: Employee[];
  services: Service[];
  appointments: Appointment[];
  loading: boolean;
  loadAll: () => Promise<void>;
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  getEmployee: (id: string) => Employee | undefined;
  getService: (id: string) => Service | undefined;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s, a] = await Promise.all([
        dashboardApi.employees(),
        dashboardApi.services(),
        dashboardApi.appointments(),
      ]);
      setEmployees(e.employees);
      setServices(s.services);
      setAppointments(a.appointments);
    } finally {
      setLoading(false);
    }
  }, []);

  const getEmployee = useCallback(
    (id: string) => employees.find((e) => e.id === id),
    [employees],
  );

  const getService = useCallback(
    (id: string) => services.find((s) => s.id === id),
    [services],
  );

  const value = useMemo(
    () => ({
      employees,
      services,
      appointments,
      loading,
      loadAll,
      setAppointments,
      setEmployees,
      setServices,
      getEmployee,
      getService,
    }),
    [
      employees,
      services,
      appointments,
      loading,
      loadAll,
      getEmployee,
      getService,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}
