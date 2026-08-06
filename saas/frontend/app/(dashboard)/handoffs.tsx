import { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import { SofPageHeader } from '@/src/components/ui';
import { HandoffInbox } from '@/src/features/handoffs/HandoffInbox';
import { useEntitlements } from '@/src/entitlements/useEntitlements';

export default function HandoffsScreen() {
  const { has } = useEntitlements();
  const {
    handoffs,
    setHandoffs,
    employees,
    handoffLiveMessage,
  } = useDashboard();

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
      />

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
});
