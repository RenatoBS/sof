import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { marketingColors } from '@/src/theme/marketing';

export function MarketingNav({ active }: { active?: string }) {
  const items = [
    { href: '/', label: 'Início', key: 'home' },
    { href: '/pricing', label: 'Planos', key: 'pricing' },
    { href: '/about', label: 'Quem somos', key: 'about' },
    { href: '/login', label: 'Entrar', key: 'login' },
  ] as const;

  return (
    <View style={styles.nav}>
      <Link href="/" asChild>
        <Pressable>
          <Text style={styles.logo}>
            soft<Text style={styles.dot}>.</Text>
          </Text>
        </Pressable>
      </Link>
      <View style={styles.links}>
        {items.map((item) => (
          <Link key={item.key} href={item.href} asChild>
            <Pressable>
              <Text
                style={[
                  styles.link,
                  active === item.key && styles.linkActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: marketingColors.line,
    backgroundColor: marketingColors.paper,
  },
  logo: { fontSize: 22, fontWeight: '700', color: marketingColors.ink },
  dot: { color: marketingColors.accent },
  links: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  link: { color: marketingColors.muted, fontSize: 14, fontWeight: '500' },
  linkActive: { color: marketingColors.accent },
});
