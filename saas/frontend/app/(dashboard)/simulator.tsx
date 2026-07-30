import Head from 'expo-router/head';
import { ScrollView, StyleSheet } from 'react-native';
import { WhatsappSimulatorPanel } from '@/src/features/whatsapp/WhatsappSimulatorPanel';

/**
 * WhatsApp bot simulator — outside tabs, noindex.
 * URL: /(dashboard)/simulator → /simulator
 */
export default function SimulatorScreen() {
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
