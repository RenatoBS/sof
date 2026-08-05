import { Redirect, Slot, router, usePathname } from 'expo-router';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import {
  SofButton,
  SofIconAction,
  SofLoadingGate,
} from '@/src/components/ui';
import { BusinessLogo } from '@/src/components/BusinessLogo';
import { d } from '@/src/theme/dashboard';

function EmployeeChrome({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const { employee, loading, logout } = useEmployeeAuth();
  const pathname = usePathname();
  const onChangePassword = pathname.includes('change-password');
  const onSupport = pathname.includes('support');
  const onHandoffs = pathname.includes('handoffs');
  const canHandoffs = Boolean(employee?.canHandleHandoffs);

  if (loading) {
    return <SofLoadingGate label="Carregando…" />;
  }

  if (!employee) return <Redirect href="/login" />;

  if (employee.mustChangePassword && !onChangePassword) {
    return <Redirect href="/(employee)/change-password" />;
  }

  if (!employee.mustChangePassword && onChangePassword) {
    return <Redirect href="/(employee)/agenda" />;
  }

  if (!canHandoffs && onHandoffs) {
    return <Redirect href="/(employee)/agenda" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View
          style={[styles.topbarInner, isCompact && styles.topbarInnerCompact]}
        >
          <View style={styles.brandBlock}>
            <BusinessLogo
              uri={employee.logoBase64}
              initials={employee.businessName}
              size={isCompact ? 36 : 40}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.biz, isCompact && styles.bizCompact]}
                numberOfLines={1}
              >
                {employee.businessName}
              </Text>
              <Text style={styles.who} numberOfLines={1}>
                {employee.name}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            {!onChangePassword && canHandoffs && !onHandoffs ? (
              <SofButton
                title="Atendimentos"
                variant="light"
                theme="dashboard"
                onPress={() => router.push('/(employee)/handoffs')}
              />
            ) : null}
            {!onChangePassword && onHandoffs ? (
              <SofButton
                title="Agenda"
                variant="light"
                theme="dashboard"
                onPress={() => router.push('/(employee)/agenda')}
              />
            ) : null}
            {!onChangePassword && !onSupport && !onHandoffs ? (
              <SofButton
                title="Suporte"
                variant="light"
                theme="dashboard"
                onPress={() => router.push('/(employee)/support')}
              />
            ) : null}
            {!onChangePassword && onSupport ? (
              <SofButton
                title="Agenda"
                variant="light"
                theme="dashboard"
                onPress={() => router.push('/(employee)/agenda')}
              />
            ) : null}
            <SofIconAction
              action="logout"
              forceCompact
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
            />
          </View>
        </View>
      </View>
      <View style={[styles.main, isCompact && styles.mainCompact]}>
        {children}
      </View>
    </View>
  );
}

export default function EmployeeLayout() {
  return (
    <EmployeeChrome>
      <Slot />
    </EmployeeChrome>
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
    gap: 8,
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  biz: {
    fontSize: 22,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.3,
  },
  bizCompact: { fontSize: 18 },
  who: { fontSize: 14, color: d.muted, marginTop: 4, fontFamily: d.fonts.body },
  main: { flex: 1, padding: 32 },
  mainCompact: { padding: 16 },
});
