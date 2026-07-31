import { Redirect, Slot, usePathname, router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAdminAuth } from '@/src/auth/AdminAuthProvider';
import { colors, fonts, radius, space } from '@/src/theme/admin';

function openPublicGuides() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open('/guides', '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL('/guides');
}

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
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>Sof</Text>
          <Text style={styles.brandTag}>Admin</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.linksScroll}
          contentContainerStyle={styles.links}
        >
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
          <NavLink
            label="Docs"
            active={pathname === '/docs' || pathname.startsWith('/docs/')}
            onPress={() => router.push('/docs' as Href)}
          />
          <NavLink
            label="Guias"
            active={false}
            onPress={openPublicGuides}
          />
        </ScrollView>
        <View style={styles.right}>
          <Text style={styles.email} numberOfLines={1}>
            {admin.email}
          </Text>
          <Pressable onPress={() => logout().then(() => undefined)}>
            {({ pressed }) => (
              <Text style={[styles.logout, pressed && styles.logoutPressed]}>
                Sair
              </Text>
            )}
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
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.link,
        active && styles.linkActive,
        !active && (hovered || pressed) && styles.linkHovered,
      ]}
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
    gap: space.md,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.accent,
  },
  brandTag: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  linksScroll: { flex: 1 },
  links: { flexDirection: 'row', alignItems: 'center' },
  link: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm - 2,
    marginRight: space.sm,
  },
  linkHovered: { backgroundColor: colors.fill },
  linkActive: { backgroundColor: colors.accentSoft },
  linkText: {
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
    fontSize: 14,
  },
  linkTextActive: { color: colors.accent },
  right: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  email: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 13,
    marginRight: space.md,
    maxWidth: 200,
  },
  logout: {
    fontFamily: fonts.bodyMedium,
    color: colors.danger,
    fontSize: 13,
  },
  logoutPressed: { opacity: 0.65 },
  body: {
    flex: 1,
    padding: space.lg,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
});
