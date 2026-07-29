import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SofButton } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

const NAV_LINKS = [
  { key: 'home', label: 'Início', href: '/' },
  { key: 'pricing', label: 'Planos', href: '/pricing' },
  { key: 'about', label: 'Quem somos', href: '/about' },
] as const;

export function Wordmark({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress || (() => router.push('/'))}
      style={({ pressed }) => [styles.wordmark, pressed && { opacity: 0.8 }]}
      accessibilityRole="link"
      accessibilityLabel="Sof — início"
    >
      <Text style={styles.wordmarkText}>sof</Text>
      <View style={styles.dot} />
    </Pressable>
  );
}

export function MarketingNav({ active }: { active?: string }) {
  const { width } = useWindowDimensions();
  const compact = width < 860;
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (href: string) => {
    setMenuOpen(false);
    router.push(href as '/');
  };

  return (
    <View style={styles.nav}>
      <View style={styles.inner}>
        <Wordmark />
        {!compact ? (
          <View style={styles.links}>
            {NAV_LINKS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => go(item.href)}
                accessibilityRole="link"
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <Text
                  style={[styles.link, active === item.key && styles.linkActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable
            onPress={() => setMenuOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.menuBtnText}>{menuOpen ? 'Fechar' : 'Menu'}</Text>
          </Pressable>
        )}
        <View style={styles.cta}>
          <SofButton title="Entrar" variant="ghost" onPress={() => go('/login')} />
          <SofButton
            title="Começar"
            variant="solid"
            onPress={() => go('/pricing')}
          />
        </View>
      </View>
      {compact && menuOpen ? (
        <View style={styles.mobileMenu}>
          {NAV_LINKS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => go(item.href)}
              style={({ pressed }) => [
                styles.mobileLink,
                active === item.key && styles.mobileLinkActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.mobileLinkText,
                  active === item.key && styles.linkActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SiteFooter() {
  return (
    <View style={styles.footer}>
      <View style={styles.footerInner}>
        <Wordmark />
        <View style={styles.footerLinks}>
          <Pressable onPress={() => router.push('/pricing')}>
            <Text style={styles.footerLink}>Planos</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/about')}>
            <Text style={styles.footerLink}>Quem somos</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={styles.footerLink}>Entrar</Text>
          </Pressable>
        </View>
        <Text style={styles.fine}>© 2026 Sof. Feito com calma.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: 'rgba(244,244,246,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: m.line,
    zIndex: 50,
  },
  inner: {
    maxWidth: m.wrap,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmarkText: {
    fontFamily: m.fonts.displayBold,
    fontSize: 24,
    letterSpacing: -0.7,
    color: m.ink,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: m.accent,
    marginBottom: 2,
  },
  links: { flexDirection: 'row', gap: 32, flex: 1, justifyContent: 'center' },
  link: {
    color: m.muted,
    fontSize: 15,
    fontFamily: m.fonts.bodyMedium,
  },
  linkActive: { color: m.ink },
  menuBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: m.line,
    backgroundColor: m.surface,
  },
  menuBtnText: {
    fontFamily: m.fonts.bodyMedium,
    fontSize: 14,
    color: m.ink,
  },
  mobileMenu: {
    borderTopWidth: 1,
    borderTopColor: m.line,
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 4,
    backgroundColor: m.paper,
  },
  mobileLink: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: m.radiusSm,
  },
  mobileLinkActive: { backgroundColor: m.accentSoft },
  mobileLinkText: {
    fontFamily: m.fonts.bodyMedium,
    fontSize: 16,
    color: m.muted,
  },
  cta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: m.line,
    paddingVertical: 40,
    marginTop: 40,
  },
  footerInner: {
    maxWidth: m.wrap,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 18,
  },
  footerLinks: { flexDirection: 'row', gap: 22 },
  footerLink: { color: m.muted, fontSize: 14, fontFamily: m.fonts.body },
  fine: { color: m.muted, fontSize: 14, fontFamily: m.fonts.body },
});
