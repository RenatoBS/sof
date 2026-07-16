import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Appointment, Client, Employee, Service } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';

type DashboardContextValue = {
  employees: Employee[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  loading: boolean;
  loadAll: () => Promise<void>;
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  getEmployee: (id: string) => Employee | undefined;
  getService: (id: string) => Service | undefined;
  getClient: (id: string) => Client | undefined;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s, c, a] = await Promise.all([
        dashboardApi.employees(),
        dashboardApi.services(),
        dashboardApi.clients(),
        dashboardApi.appointments(),
      ]);
      setEmployees(e.employees);
      setServices(s.services);
      setClients(c.clients);
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

  const getClient = useCallback(
    (id: string) => clients.find((c) => c.id === id),
    [clients],
  );

  const value = useMemo(
    () => ({
      employees,
      services,
      clients,
      appointments,
      loading,
      loadAll,
      setAppointments,
      setEmployees,
      setServices,
      setClients,
      getEmployee,
      getService,
      getClient,
    }),
    [
      employees,
      services,
      clients,
      appointments,
      loading,
      loadAll,
      getEmployee,
      getService,
      getClient,
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

export function formatPhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return formatPhone(digits.slice(2));
  }
  return phone || '—';
}
