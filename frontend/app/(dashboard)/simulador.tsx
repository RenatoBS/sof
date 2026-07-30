import Head from 'expo-router/head';
import { ScrollView, StyleSheet } from 'react-native';
import { WhatsappSimulatorPanel } from '@/src/features/whatsapp/WhatsappSimulatorPanel';

/**
 * Simulador do bot — fora das tabs e com noindex (não deve aparecer em buscas).
 * URL: /(dashboard)/simulador → /simulador
 */
export default function SimuladorScreen() {
  return (
    <>
      <Head>
        <title>Simulador WhatsApp · Sof</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta
          name="description"
          content="Ferramenta interna de teste do bot WhatsApp da Sof."
        />
      </Head>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <WhatsappSimulatorPanel />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 48 },
});
