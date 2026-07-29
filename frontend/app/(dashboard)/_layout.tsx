import { Redirect, Slot, router, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '@/src/auth/AuthProvider';
import { useEntitlements } from '@/src/entitlements/useEntitlements';
import { dashboardApi } from '@/src/api/endpoints';
import { DashboardProvider, useDashboard } from '@/src/context/DashboardContext';
import { useToast } from '@/src/context/ToastContext';
import { useRealtime } from '@/src/hooks/useRealtime';
import { SofButton, SofLoadingGate } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';
import type { Appointment, WhatsappHandoff } from '@/src/api/types';
import { m } from '@/src/theme/marketing';

const ALL_TABS = [
  { href: '/(dashboard)/agenda', label: 'Agenda', match: 'agenda' },
  { href: '/(dashboard)/employees', label: 'Profissionais', match: 'employees' },
  { href: '/(dashboard)/services', label: 'Serviços', match: 'services' },
  { href: '/(dashboard)/clients', label: 'Clientes', match: 'clients' },
  {
    href: '/(dashboard)/handoffs',
    label: 'Atendimentos',
    match: 'handoffs',
    feature: 'handoffs',
  },
  { href: '/(dashboard)/support', label: 'Suporte', match: 'support' },
  {
    href: '/(dashboard)/billing',
    label: 'Faturamento',
    match: 'billing',
    feature: 'billing',
  },
  { href: '/(dashboard)/account', label: 'Conta', match: 'account' },
] as const;

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const { account, loading, logout } = useAuth();
  const { has } = useEntitlements();
  const { loadAll, setAppointments, setClients, handoffs, setHandoffs } =
    useDashboard();
  const { showToast } = useToast();
  const pathname = usePathname();

  const TABS = ALL_TABS.filter(
    (tab) => !('feature' in tab) || !tab.feature || has(tab.feature),
  );

  const openHandoffs = has('handoffs')
    ? handoffs.filter((h) => h.status === 'open').length
    : 0;

  const upsertHandoff = (handoff: WhatsappHandoff) => {
    setHandoffs((prev) => {
      const idx = prev.findIndex((h) => h.id === handoff.id);
      if (idx < 0) return [handoff, ...prev];
      return prev.map((h) => (h.id === handoff.id ? handoff : h));
    });
  };

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
        dashboardApi
          .clients()
          .then((res) => setClients(res.clients))
          .catch(() => undefined);
      },
      onUpdated: (appointment: Appointment) => {
        setAppointments((prev) => {
          if (
            appointment.status &&
            appointment.status !== 'scheduled' &&
            appointment.status !== 'completed'
          ) {
            return prev.filter((a) => a.id !== appointment.id);
          }
          return prev.map((a) => (a.id === appointment.id ? appointment : a));
        });
      },
      onDeleted: (appointmentId: string) => {
        setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      },
      onHandoffOpened: (handoff: WhatsappHandoff) => {
        upsertHandoff(handoff);
        const who =
          handoff.party === 'employee' ? 'Profissional' : 'Cliente';
        showToast(
          `${who}: ${handoff.customerName || 'contato'} precisa de atendimento no WhatsApp`,
        );
      },
      onHandoffUpdated: upsertHandoff,
      onHandoffResolved: upsertHandoff,
    },
    !!account,
  );

  if (loading) {
    return <SofLoadingGate label="Carregando painel…" />;
  }

  if (!account) return <Redirect href="/login" />;

  const onChoosePlan =
    pathname.includes('choose-plan') || pathname.endsWith('/choose-plan');

  if (account.needsPlanSelection && !onChoosePlan) {
    return <Redirect href="/(dashboard)/choose-plan" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View
          style={[styles.topbarInner, isCompact && styles.topbarInnerCompact]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.biz, isCompact && styles.bizCompact]}
              numberOfLines={1}
            >
              {account.businessName}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {account.email}
            </Text>
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

      {!account.needsPlanSelection ? (
      <View style={styles.tabbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.tabbarInner,
            isCompact && styles.tabbarInnerCompact,
          ]}
        >
          {TABS.map((tab) => {
            const active = pathname.includes(tab.match);
            const badgeCount = tab.match === 'handoffs' ? openHandoffs : 0;
            return (
              <Pressable
                key={tab.match}
                onPress={() => router.push(tab.href as '/')}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.tabBtn,
                  active && styles.tabActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={styles.tabLabelRow}>
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {tab.label}
                  </Text>
                  {badgeCount > 0 ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      ) : null}

      <ScrollView
        style={styles.main}
        contentContainerStyle={[
          styles.mainContent,
          isCompact && styles.mainContentCompact,
        ]}
      >
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
    gap: 12,
  },
  topbarInnerCompact: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  biz: {
    fontSize: 22,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.3,
  },
  bizCompact: { fontSize: 18 },
  email: {
    fontSize: 14,
    color: d.muted,
    marginTop: 4,
    fontFamily: d.fonts.body,
  },
  tabbar: {
    backgroundColor: d.surface,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  tabbarInner: {
    paddingHorizontal: 32,
    gap: 36,
  },
  tabbarInnerCompact: {
    paddingHorizontal: 16,
    gap: 20,
  },
  tabBtn: {
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: m.accent },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: {
    fontSize: 15,
    color: d.muted,
    fontWeight: '500',
    fontFamily: d.fonts.bodyMedium,
  },
  tabTextActive: { color: d.ink, fontWeight: '600' },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: d.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  main: { flex: 1 },
  mainContent: { padding: 32, gap: 32 },
  mainContentCompact: { padding: 16, gap: 20 },
});
