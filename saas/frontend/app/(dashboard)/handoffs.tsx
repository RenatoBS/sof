import { useEffect, useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import {
  SofCard,
  SofErrorBanner,
  SofPageHeader,
} from '@/src/components/ui';
import { HandoffInbox } from '@/src/features/handoffs/HandoffInbox';
import { d } from '@/src/theme/dashboard';
import { useEntitlements } from '@/src/entitlements/useEntitlements';

export default function HandoffsScreen() {
  const { has } = useEntitlements();
  const {
    handoffs,
    setHandoffs,
    employees,
    handoffLiveMessage,
  } = useDashboard();
  const [threshold, setThreshold] = useState<number | null>(null);
  const [allowed, setAllowed] = useState<number[]>([1, 2, 3, 5]);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    if (!has('handoffs')) return;
    dashboardApi
      .whatsappHandoffSettings()
      .then((res) => {
        setThreshold(res.threshold);
        setAllowed(res.allowed);
      })
      .catch(() => undefined);
  }, [has]);

  const api = useMemo(
    () => ({
      messages: dashboardApi.whatsappHandoffMessages,
      reply: dashboardApi.replyWhatsappHandoff,
      claim: dashboardApi.claimWhatsappHandoff,
      transfer: dashboardApi.transferWhatsappHandoff,
      release: dashboardApi.releaseWhatsappHandoff,
      resolve: dashboardApi.resolveWhatsappHandoff,
      returnToSof: dashboardApi.returnWhatsappHandoffToSof,
    }),
    [],
  );

  if (!has('handoffs')) return <Redirect href="/(dashboard)/agenda" />;

  const changeThreshold = async (value: number) => {
    if (savingThreshold || value === threshold) return;
    setSettingsError('');
    setSavingThreshold(true);
    const previous = threshold;
    setThreshold(value);
    try {
      await dashboardApi.updateWhatsappHandoffSettings(value);
    } catch (err) {
      setThreshold(previous);
      setSettingsError(
        err instanceof Error ? err.message : 'Não foi possível salvar.',
      );
    } finally {
      setSavingThreshold(false);
    }
  };

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Atendimentos"
        subtitle="Inbox da equipe: assuma a conversa, responda pelo Sof e transfira para profissionais habilitados. O bot fica em pausa enquanto o caso está aberto."
      />

      <SofCard>
        <Text style={styles.cardTitle}>Configuração</Text>
        <Text style={styles.hint}>
          Quantas respostas &quot;não entendi&quot; seguidas do bot abrem um
          atendimento aqui (vale para cliente e profissional). Pedidos
          explícitos por atendente sempre abrem na hora.
        </Text>
        <View style={styles.chips}>
          {allowed.map((value) => {
            const active = threshold === value;
            return (
              <Pressable
                key={value}
                onPress={() => changeThreshold(value)}
                style={[styles.chip, active && styles.chipActive]}
                disabled={savingThreshold}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {value}x
                </Text>
              </Pressable>
            );
          })}
        </View>
        {settingsError ? <SofErrorBanner message={settingsError} /> : null}
      </SofCard>

      <HandoffInbox
        handoffs={handoffs}
        onHandoffsChange={setHandoffs}
        api={api}
        mode="account"
        transferableEmployees={employees}
        liveMessage={
          handoffLiveMessage
            ? {
                handoffId: handoffLiveMessage.handoffId,
                message: handoffLiveMessage.message,
              }
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    marginBottom: 4,
  },
  hint: {
    color: d.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: d.fonts.body,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: d.surface,
  },
  chipActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  chipText: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body },
  chipTextActive: { fontWeight: '700', fontFamily: d.fonts.bodyMedium },
});
