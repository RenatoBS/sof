import { Redirect, Slot, usePathname, router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAdminAuth } from '@/src/auth/AdminAuthProvider';
import { colors, space } from '@/src/theme/admin';

export default function ShellLayout() {
  const { admin, loading, logout } = useAdminAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!admin) return <Redirect href="/login" />;

  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Sof Admin</Text>
        <View style={styles.links}>
          <NavLink
            label="Contas"
            active={
              pathname === '/accounts' ||
              pathname.startsWith('/edit-account') ||
              pathname === '/new-account'
            }
            onPress={() => router.push('/accounts')}
          />
          <NavLink
            label="Tickets"
            active={
              pathname === '/tickets' || pathname.startsWith('/edit-ticket')
            }
            onPress={() => router.push('/tickets')}
          />
          <NavLink
            label="Planos"
            active={
              pathname === '/plans' ||
              pathname.startsWith('/edit-plan') ||
              pathname === '/new-plan'
            }
            onPress={() => router.push('/plans')}
          />
          <NavLink
            label="Cupons"
            active={
              pathname === '/coupons' ||
              pathname.startsWith('/edit-coupon') ||
              pathname === '/new-coupon'
            }
            onPress={() => router.push('/coupons')}
          />
        </View>
        <View style={styles.right}>
          <Text style={styles.email}>{admin.email}</Text>
          <Pressable onPress={() => logout().then(() => undefined)}>
            <Text style={styles.logout}>Sair</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.body}>
        <Slot />
      </View>
    </View>
  );
}

function NavLink({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.link, active ? styles.linkActive : null]}
      onPress={onPress}
    >
      <Text style={[styles.linkText, active ? styles.linkTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexWrap: 'wrap',
  },
  brand: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 18,
    color: colors.accent,
    marginRight: space.lg,
  },
  links: { flexDirection: 'row', flex: 1 },
  link: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: space.sm,
  },
  linkActive: { backgroundColor: colors.accentSoft },
  linkText: {
    fontFamily: 'Inter_500Medium',
    color: colors.muted,
  },
  linkTextActive: { color: colors.accent },
  right: { flexDirection: 'row', alignItems: 'center' },
  email: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    fontSize: 13,
    marginRight: space.md,
  },
  logout: {
    fontFamily: 'Inter_500Medium',
    color: colors.danger,
    fontSize: 13,
  },
  body: {
    flex: 1,
    padding: space.lg,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
});
