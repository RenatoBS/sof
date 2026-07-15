import { Redirect, Tabs, router } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { useAuth } from '@/src/auth/AuthProvider';
import { DashboardProvider, useDashboard } from '@/src/context/DashboardContext';
import { useToast } from '@/src/context/ToastContext';
import { useRealtime } from '@/src/hooks/useRealtime';
import { LoadingGate } from '@/src/components/ui';
import { dashboardColors } from '@/src/theme/dashboard';
import type { Appointment } from '@/src/api/types';

function DashboardGate({ children }: { children: React.ReactNode }) {
  const { account, loading, logout } = useAuth();
  const { loadAll, setAppointments } = useDashboard();
  const { showToast } = useToast();

  useEffect(() => {
    if (account) loadAll().catch(() => undefined);
  }, [account, loadAll]);

  useRealtime(
    {
      onCreated: (appointment: Appointment) => {
        setAppointments((prev) => {
          if (prev.some((a) => a.id === appointment.id)) return prev;
          return [...prev, appointment];
        });
        if (appointment.source === 'whatsapp') {
          showToast('Novo agendamento via WhatsApp!');
        }
      },
      onUpdated: (appointment: Appointment) => {
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointment.id ? appointment : a)),
        );
      },
      onDeleted: (appointmentId: string) => {
        setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      },
    },
    !!account,
  );

  if (loading) return <LoadingGate loading />;
  if (!account) return <Redirect href="/login" />;

  return (
    <>
      <Pressable
        onPress={async () => {
          await logout();
          router.replace('/');
        }}
        style={{ padding: 12, alignSelf: 'flex-end' }}
      >
        <Text style={{ color: dashboardColors.muted }}>Sair</Text>
      </Pressable>
      {children}
    </>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardProvider>
      <DashboardGate>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: dashboardColors.accent,
          }}
        >
          <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
          <Tabs.Screen name="employees" options={{ title: 'Profissionais' }} />
          <Tabs.Screen name="services" options={{ title: 'Serviços' }} />
          <Tabs.Screen name="billing" options={{ title: 'Faturamento' }} />
          <Tabs.Screen name="account" options={{ title: 'Conta' }} />
        </Tabs>
      </DashboardGate>
    </DashboardProvider>
  );
}
