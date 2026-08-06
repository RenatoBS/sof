import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import type { HandoffMacro } from '@/src/api/types';
import { useDashboard } from '@/src/context/DashboardContext';
import { SofButton, SofPageHeader } from '@/src/components/ui';
import { HandoffInbox } from '@/src/features/handoffs/HandoffInbox';
import { HandoffMacrosModal } from '@/src/features/handoffs/HandoffMacrosModal';
import { useEntitlements } from '@/src/entitlements/useEntitlements';

export default function HandoffsScreen() {
  const { has } = useEntitlements();
  const {
    handoffs,
    setHandoffs,
    employees,
    handoffLiveMessage,
  } = useDashboard();
  const [macros, setMacros] = useState<HandoffMacro[]>([]);
  const [macrosOpen, setMacrosOpen] = useState(false);

  const loadMacros = useCallback(async () => {
    try {
      const res = await dashboardApi.handoffMacros();
      setMacros(res.macros.filter((m) => m.active));
    } catch {
      setMacros([]);
    }
  }, []);

  useEffect(() => {
    void loadMacros();
  }, [loadMacros]);

  const onMacrosChanged = useCallback((all: HandoffMacro[]) => {
    setMacros(all.filter((m) => m.active));
  }, []);

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

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Atendimentos"
        subtitle="Inbox da equipe: assuma a conversa, responda pelo Sof e transfira para profissionais habilitados. O bot fica em pausa enquanto o caso está aberto. O limiar de “não entendi” fica em Conta."
        action={
          <SofButton
            title="Macros"
            variant="light"
            theme="dashboard"
            onPress={() => setMacrosOpen(true)}
          />
        }
      />

      <HandoffInbox
        handoffs={handoffs}
        onHandoffsChange={setHandoffs}
        api={api}
        mode="account"
        transferableEmployees={employees}
        macros={macros}
        liveMessage={
          handoffLiveMessage
            ? {
                handoffId: handoffLiveMessage.handoffId,
                message: handoffLiveMessage.message,
              }
            : null
        }
      />

      <HandoffMacrosModal
        visible={macrosOpen}
        onClose={() => setMacrosOpen(false)}
        onChanged={onMacrosChanged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
});
