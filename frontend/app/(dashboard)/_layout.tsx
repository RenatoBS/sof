import { Redirect, Slot, router, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/src/auth/AuthProvider';
import { DashboardProvider, useDashboard } from '@/src/context/DashboardContext';
import { useToast } from '@/src/context/ToastContext';
import { useRealtime } from '@/src/hooks/useRealtime';
import { SofButton } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';
import type { Appointment } from '@/src/api/types';

const TABS = [
  { href: '/(dashboard)/agenda', label: 'Agenda', match: 'agenda' },
  { href: '/(dashboard)/employees', label: 'Profissionais', match: 'employees' },
  { href: '/(dashboard)/services', label: 'Serviços', match: 'services' },
  { href: '/(dashboard)/billing', label: 'Faturamento', match: 'billing' },
  { href: '/(dashboard)/account', label: 'Conta', match: 'account' },
] as const;

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { account, loading, logout } = useAuth();
  const { loadAll, setAppointments } = useDashboard();
  const { showToast } = useToast();
  const pathname = usePathname();

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

  if (loading) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={d.muted} />
        <Text style={styles.gateText}>Carregando painel…</Text>
      </View>
    );
  }

  if (!account) return <Redirect href="/login" />;

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View style={styles.topbarInner}>
          <View>
            <Text style={styles.biz}>{account.businessName}</Text>
            <Text style={styles.email}>{account.email}</Text>
          </View>
          <SofButton
            title="Sair"
            variant="light"
            theme="dashboard"
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
          />
        </View>
      </View>

      <View style={styles.tabbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabbarInner}
        >
          {TABS.map((tab) => {
            const active = pathname.includes(tab.match);
            return (
              <Pressable
                key={tab.match}
                onPress={() => router.push(tab.href as '/')}
                style={[styles.tabBtn, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        {children}
      </ScrollView>
    </View>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardProvider>
      <DashboardChrome>
        <Slot />
      </DashboardChrome>
    </DashboardProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: d.paper },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: d.paper,
  },
  gateText: { color: d.muted, fontSize: 15 },
  topbar: {
    backgroundColor: d.surface,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  topbarInner: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  biz: { fontSize: 24, fontWeight: '700', color: d.ink },
  email: { fontSize: 14, color: d.muted, marginTop: 4 },
  tabbar: {
    backgroundColor: d.surface,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  tabbarInner: {
    paddingHorizontal: 32,
    gap: 48,
  },
  tabBtn: {
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: d.ink },
  tabText: { fontSize: 15, color: d.muted, fontWeight: '500' },
  tabTextActive: { color: d.ink, fontWeight: '600' },
  main: { flex: 1 },
  mainContent: { padding: 32, gap: 32 },
});
