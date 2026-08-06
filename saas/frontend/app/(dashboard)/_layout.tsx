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
import { SofIconAction, SofLoadingGate } from '@/src/components/ui';
import { BusinessLogo } from '@/src/components/BusinessLogo';
import {
  DashboardTabIcon,
  type DashboardTabIconName,
} from '@/src/components/DashboardTabIcon';
import { d } from '@/src/theme/dashboard';
import type { Appointment, Client, WhatsappHandoff } from '@/src/api/types';

const ALL_TABS: {
  href: string;
  label: string;
  match: string;
  icon: DashboardTabIconName;
  feature?: 'handoffs' | 'billing';
}[] = [
  {
    href: '/(dashboard)/agenda',
    label: 'Agenda',
    match: 'agenda',
    icon: 'agenda',
  },
  {
    href: '/(dashboard)/employees',
    label: 'Profissionais',
    match: 'employees',
    icon: 'employees',
  },
  {
    href: '/(dashboard)/services',
    label: 'Serviços',
    match: 'services',
    icon: 'services',
  },
  {
    href: '/(dashboard)/products',
    label: 'Produtos',
    match: 'products',
    icon: 'products',
  },
  {
    href: '/(dashboard)/clients',
    label: 'Clientes',
    match: 'clients',
    icon: 'clients',
  },
  {
    href: '/(dashboard)/handoffs',
    label: 'Atendimentos',
    match: 'handoffs',
    icon: 'handoffs',
    feature: 'handoffs',
  },
  {
    href: '/(dashboard)/billing',
    label: 'Faturamento',
    match: 'billing',
    icon: 'billing',
    feature: 'billing',
  },
  {
    href: '/(dashboard)/account',
    label: 'Conta',
    match: 'account',
    icon: 'account',
  },
];

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const { account, loading, logout } = useAuth();
  const { has } = useEntitlements();
  const { loadAll, setAppointments, setClients, handoffs, setHandoffs, setHandoffLiveMessage, services, products, loading: dashLoading } =
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
      onHandoffMessage: (handoffId, message) => {
        setHandoffLiveMessage({ handoffId, message, at: Date.now() });
      },
      onClientUpdated: (client: Client) => {
        setClients((prev) => {
          const idx = prev.findIndex((c) => c.id === client.id);
          if (idx < 0) {
            return [...prev, client].sort((a, b) =>
              a.name.localeCompare(b.name, 'pt-BR'),
            );
          }
          return prev.map((c) => (c.id === client.id ? client : c));
        });
      },
    },
    !!account,
  );

  if (loading) {
    return <SofLoadingGate label="Carregando painel…" />;
  }

  if (!account) return <Redirect href="/login" />;

  const onChoosePlan =
    pathname.includes('choose-plan') || pathname.endsWith('/choose-plan');
  const onSetupCatalog =
    pathname.includes('setup-catalog') || pathname.endsWith('/setup-catalog');

  if (account.needsPlanSelection && !onChoosePlan) {
    return <Redirect href="/(dashboard)/choose-plan" />;
  }

  const needsCatalogSetup =
    !account.needsPlanSelection &&
    !dashLoading &&
    services.length + products.length === 0;

  if (needsCatalogSetup && !onSetupCatalog) {
    return <Redirect href={'/(dashboard)/setup-catalog' as '/'} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View
          style={[styles.topbarInner, isCompact && styles.topbarInnerCompact]}
        >
          <View style={styles.brandBlock}>
            <BusinessLogo
              uri={account.logoBase64}
              initials={account.businessName}
              size={isCompact ? 36 : 40}
            />
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
          </View>
          <SofIconAction
            action="logout"
            forceCompact
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
          />
        </View>
      </View>

      {!account.needsPlanSelection && !onSetupCatalog ? (
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
                <View style={styles.tabContent}>
                  <DashboardTabIcon
                    name={tab.icon}
                    color={active ? d.accent : d.mutedStrong}
                    size={isCompact ? 15 : 16}
                  />
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
  brandBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    gap: 16,
  },
  tabBtn: {
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: d.accent },
  tabContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
