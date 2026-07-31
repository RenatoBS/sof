import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import { SofButton, SofPageHeader } from '@/src/components/ui';
import { maskPhoneWithDdi, normalizePhoneDigits } from '@/src/lib/validation';
import { d } from '@/src/theme/dashboard';

const COMPACT_BREAKPOINT = 720;

/** Simulador do bot WhatsApp (demo). Página interna — não listada nas tabs. */
export function WhatsappSimulatorPanel() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const { loadAll } = useDashboard();
  const [waPhone, setWaPhone] = useState(maskPhoneWithDdi('5511999990000'));
  const [waMessage, setWaMessage] = useState('');
  const [waLog, setWaLog] = useState<{ dir: 'in' | 'out'; text: string }[]>(
    [],
  );
  const [waLoading, setWaLoading] = useState(false);
  const [waOn, setWaOn] = useState(false);

  useEffect(() => {
    dashboardApi
      .integrations()
      .then((data) => setWaOn(data.whatsapp.configured))
      .catch(() => undefined);
  }, []);

  const simulateWa = async () => {
    if (!waMessage.trim()) return;
    setWaLog((l) => [...l, { dir: 'out', text: waMessage }]);
    setWaLoading(true);
    try {
      const data = await dashboardApi.simulateWhatsapp(
        waMessage,
        normalizePhoneDigits(waPhone),
      );
      setWaLog((l) => [
        ...l,
        ...data.replies.map((text) => ({ dir: 'in' as const, text })),
      ]);
      if (data.appointment) await loadAll();
      setWaMessage('');
    } finally {
      setWaLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Simulador WhatsApp"
        subtitle="Teste o bot sem número real. Em produção, as mensagens do WhatsApp conectado caem na Agenda."
      />

      <View style={[styles.card, isCompact && styles.cardCompact]}>
        <Text style={styles.cardTitle}>Conversa</Text>
        <Text style={styles.cardDesc}>
          Status:{' '}
          <Text style={[styles.waStatus, waOn ? styles.waOn : styles.waOff]}>
            {waOn ? 'WhatsApp conectado' : 'modo demo'}
          </Text>
        </Text>
        <ScrollView
          style={styles.waLog}
          contentContainerStyle={styles.waLogInner}
        >
          {waLog.length === 0 ? (
            <Text style={styles.emptyLog}>
              Envie “oi” para começar. Use o telefone de um profissional para
              testar o menu operacional.
            </Text>
          ) : (
            waLog.map((b, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  b.dir === 'out' ? styles.bubbleOut : styles.bubbleIn,
                ]}
              >
                <Text style={styles.bubbleText}>{b.text}</Text>
              </View>
            ))
          )}
        </ScrollView>
        <View style={[styles.waForm, isCompact && styles.waFormCompact]}>
          <TextInput
            style={[styles.waInput, isCompact && styles.waInputCompact]}
            value={waPhone}
            onChangeText={(t) => setWaPhone(maskPhoneWithDdi(t))}
            placeholder="Telefone do cliente"
            accessibilityLabel="Telefone do cliente"
            keyboardType="phone-pad"
            inputMode="tel"
          />
          <TextInput
            style={[
              styles.waInput,
              { flex: 1 },
              isCompact && styles.waInputCompact,
            ]}
            value={waMessage}
            onChangeText={setWaMessage}
            placeholder="Mensagem (ex.: oi)"
            accessibilityLabel="Mensagem"
            onSubmitEditing={simulateWa}
          />
          <SofButton
            title={waLoading ? '…' : 'Enviar'}
            variant="dark"
            theme="dashboard"
            disabled={waLoading || !waMessage.trim()}
            onPress={simulateWa}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 32,
    gap: 12,
    ...d.shadow.soft,
  },
  cardCompact: { padding: 16 },
  cardTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  cardDesc: {
    color: d.muted,
    fontSize: 14,
    marginBottom: 4,
    fontFamily: d.fonts.body,
  },
  waStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  waOn: { color: d.waGreenText, backgroundColor: '#e7f9ef' },
  waOff: { color: '#94a3b8', backgroundColor: '#f1f5f9' },
  waLog: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    minHeight: 200,
    maxHeight: 420,
  },
  waLogInner: { padding: 16, gap: 8 },
  emptyLog: {
    color: d.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: d.fonts.body,
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: d.ink,
    fontFamily: d.fonts.body,
  },
  bubbleOut: { backgroundColor: '#dcf8c6', alignSelf: 'flex-end' },
  bubbleIn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: d.line,
    alignSelf: 'flex-start',
  },
  waForm: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  waFormCompact: { flexDirection: 'column', alignItems: 'stretch' },
  waInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: d.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    minWidth: 160,
    backgroundColor: '#fff',
    fontFamily: d.fonts.body,
  },
  waInputCompact: { minWidth: 0, width: '100%' },
});
