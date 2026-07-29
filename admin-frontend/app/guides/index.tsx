import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '@/src/theme/admin';

const STATIC = {
  onboarding: '/guides/onboarding-cliente.html',
  bot: '/guides/bot-whatsapp.html',
} as const;

function openStatic(path: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(path);
  }
}

export default function GuidesHub() {
  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>Sof · Guias públicos</Text>
      <Text style={styles.title}>Material para o cliente</Text>
      <Text style={styles.lede}>
        Links sem login — copie e envie para o estabelecimento. Também funcionam
        as rotas /guides/onboarding e /guides/bot.
      </Text>

      <View style={styles.cards}>
        <GuideCard
          title="Onboarding"
          body="Do plano ou cupom até WhatsApp, serviços e profissionais — com prints."
          href="/guides/onboarding"
          staticPath={STATIC.onboarding}
        />
        <GuideCard
          title="Bot WhatsApp"
          body="Fluxo do cliente (agendar) e do profissional (operar a agenda no celular)."
          href="/guides/bot"
          staticPath={STATIC.bot}
        />
      </View>

      <Link href="/login" asChild>
        <Pressable style={styles.loginLink}>
          {({ pressed }) => (
            <Text style={[styles.loginText, pressed && { opacity: 0.7 }]}>
              Entrar no admin
            </Text>
          )}
        </Pressable>
      </Link>
    </View>
  );
}

function GuideCard({
  title,
  body,
  href,
  staticPath,
}: {
  title: string;
  body: string;
  href: string;
  staticPath: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <View style={styles.actions}>
        <Link href={href} asChild>
          <Pressable style={styles.btnPrimary}>
            {({ pressed }) => (
              <Text style={[styles.btnPrimaryText, pressed && { opacity: 0.85 }]}>
                Abrir guia
              </Text>
            )}
          </Pressable>
        </Link>
        <Pressable style={styles.btnGhost} onPress={() => openStatic(staticPath)}>
          {({ pressed }) => (
            <Text style={[styles.btnGhostText, pressed && { opacity: 0.7 }]}>
              HTML direto
            </Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.path} selectable>
        {staticPath}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    padding: space.xl,
    backgroundColor: colors.bg,
  },
  kicker: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.copper,
    marginBottom: space.sm,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    letterSpacing: -0.4,
    color: colors.ink,
    marginBottom: space.sm,
  },
  lede: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: space.xl,
  },
  cards: { gap: space.md },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.lg,
  },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.ink,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginBottom: space.md,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  btnPrimary: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  btnPrimaryText: {
    fontFamily: fonts.bodyMedium,
    color: colors.paper,
    fontSize: 14,
  },
  btnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnGhostText: {
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
    fontSize: 14,
  },
  path: {
    marginTop: space.sm,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  loginLink: { marginTop: space.xl, alignSelf: 'flex-start' },
  loginText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.copper,
  },
});
