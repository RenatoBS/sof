import { Link, Redirect, Slot, usePathname } from 'expo-router';
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
            href="/accounts"
            label="Contas"
            active={pathname === '/accounts' || pathname.startsWith('/edit-account') || pathname === '/new-account'}
          />
          <NavLink
            href="/plans"
            label="Planos"
            active={pathname === '/plans' || pathname.startsWith('/edit-plan') || pathname === '/new-plan'}
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
  href,
  label,
  active,
}: {
  href: '/accounts' | '/plans';
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={[styles.link, active && styles.linkActive]}>
        <Text style={[styles.linkText, active && styles.linkTextActive]}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
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
  },
  links: { flexDirection: 'row', gap: space.sm, flex: 1 },
  link: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  linkActive: { backgroundColor: colors.accentSoft },
  linkText: {
    fontFamily: 'Inter_500Medium',
    color: colors.muted,
  },
  linkTextActive: { color: colors.accent },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  email: { fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 13 },
  logout: {
    fontFamily: 'Inter_500Medium',
    color: colors.danger,
    fontSize: 13,
  },
  body: { flex: 1, padding: space.lg, maxWidth: 1100, width: '100%', alignSelf: 'center' },
});
