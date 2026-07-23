import { Redirect, Slot, router, usePathname } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import { SofButton } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

function EmployeeChrome({ children }: { children: React.ReactNode }) {
  const { employee, loading, logout } = useEmployeeAuth();
  const pathname = usePathname();
  const onChangePassword = pathname.includes('trocar-senha');
  const onSupport = pathname.includes('support');

  if (loading) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={d.muted} />
        <Text style={styles.gateText}>Carregando…</Text>
      </View>
    );
  }

  if (!employee) return <Redirect href="/login" />;

  if (employee.mustChangePassword && !onChangePassword) {
    return <Redirect href="/(profissional)/trocar-senha" />;
  }

  if (!employee.mustChangePassword && onChangePassword) {
    return <Redirect href="/(profissional)/agenda" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View style={styles.topbarInner}>
          <View>
            <Text style={styles.biz}>{employee.businessName}</Text>
            <Text style={styles.email}>
              {employee.name} · {employee.email}
            </Text>
          </View>
          <View style={styles.actions}>
            {!onChangePassword && !onSupport ? (
              <SofButton
                title="Suporte"
                variant="light"
                theme="dashboard"
                onPress={() => router.push('/(profissional)/support')}
              />
            ) : null}
            {!onChangePassword && onSupport ? (
              <SofButton
                title="Agenda"
                variant="light"
                theme="dashboard"
                onPress={() => router.push('/(profissional)/agenda')}
              />
            ) : null}
            <SofButton
              title="Sair"
              variant="light"
              theme="dashboard"
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
            />
          </View>
        </View>
      </View>
      <View style={styles.main}>{children}</View>
    </View>
  );
}

export default function ProfissionalLayout() {
  return (
    <EmployeeChrome>
      <Slot />
    </EmployeeChrome>
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
    flexWrap: 'wrap',
    gap: 12,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  biz: { fontSize: 22, fontWeight: '700', color: d.ink },
  email: { fontSize: 14, color: d.muted, marginTop: 4 },
  main: { flex: 1, padding: 32 },
});
