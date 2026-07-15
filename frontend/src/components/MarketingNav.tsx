import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SoftButton } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

export function Wordmark({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress || (() => router.push('/'))} style={styles.wordmark}>
      <Text style={styles.wordmarkText}>sof</Text>
      <View style={styles.dot} />
    </Pressable>
  );
}

export function MarketingNav({ active }: { active?: string }) {
  const { width } = useWindowDimensions();
  const compact = width < 860;

  return (
    <View style={styles.nav}>
      <View style={styles.inner}>
        <Wordmark />
        {!compact ? (
          <View style={styles.links}>
            {[
              { key: 'home', label: 'Início', href: '/' },
              { key: 'pricing', label: 'Planos', href: '/pricing' },
              { key: 'about', label: 'Quem somos', href: '/about' },
            ].map((item) => (
              <Pressable key={item.key} onPress={() => router.push(item.href as '/')}>
                <Text style={[styles.link, active === item.key && styles.linkActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.cta}>
          <SoftButton title="Entrar" variant="ghost" onPress={() => router.push('/login')} />
          <SoftButton title="Começar" variant="solid" onPress={() => router.push('/pricing')} />
        </View>
      </View>
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
    borderBottomColor: 'transparent',
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
  footerLink: { color: m.muted, fontSize: 14 },
  fine: { color: m.muted, fontSize: 14 },
});
