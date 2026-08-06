import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { employeeApi } from '@/src/api/endpoints';
import type {
  HandoffMacro,
  WhatsappHandoff,
  WhatsappMessage,
} from '@/src/api/types';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import { SofLoadingGate, SofPageHeader } from '@/src/components/ui';
import { HandoffInbox } from '@/src/features/handoffs/HandoffInbox';
import { useRealtime } from '@/src/hooks/useRealtime';

export default function EmployeeHandoffsScreen() {
  const { employee, loading: authLoading } = useEmployeeAuth();
  const [handoffs, setHandoffs] = useState<WhatsappHandoff[]>([]);
  const [macros, setMacros] = useState<HandoffMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMessage, setLiveMessage] = useState<{
    handoffId: string;
    message: WhatsappMessage;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [handoffsRes, macrosRes] = await Promise.all([
        employeeApi.whatsappHandoffs(),
        employeeApi.handoffMacros().catch(() => ({ macros: [] as HandoffMacro[] })),
      ]);
      setHandoffs(handoffsRes.handoffs);
      setMacros(macrosRes.macros);
    } catch {
      setHandoffs([]);
      setMacros([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!employee?.canHandleHandoffs) return;
    void load();
  }, [employee?.canHandleHandoffs, load]);

  const upsert = useCallback((handoff: WhatsappHandoff) => {
    if (handoff.party === 'employee') return;
    setHandoffs((prev) => {
      const visible =
        handoff.status === 'resolved' ||
        !handoff.assigneeType ||
        (handoff.assigneeType === 'employee' &&
          handoff.assignedEmployeeId === employee?.id);
      const idx = prev.findIndex((h) => h.id === handoff.id);
      if (!visible) {
        if (idx < 0) return prev;
        return prev.filter((h) => h.id !== handoff.id);
      }
      if (idx < 0) return [handoff, ...prev];
      return prev.map((h) => (h.id === handoff.id ? handoff : h));
    });
  }, [employee?.id]);

  useRealtime(
    {
      onHandoffOpened: upsert,
      onHandoffUpdated: upsert,
      onHandoffResolved: upsert,
      onHandoffMessage: (handoffId, message) => {
        setLiveMessage({ handoffId, message });
      },
    },
    Boolean(employee?.canHandleHandoffs),
    'employee',
  );

  const api = useMemo(
    () => ({
      messages: employeeApi.whatsappHandoffMessages,
      reply: employeeApi.replyWhatsappHandoff,
      claim: employeeApi.claimWhatsappHandoff,
      transfer: employeeApi.transferWhatsappHandoff,
      release: employeeApi.releaseWhatsappHandoff,
      resolve: employeeApi.resolveWhatsappHandoff,
      returnToSof: employeeApi.returnWhatsappHandoffToSof,
    }),
    [],
  );

  if (authLoading) {
    return <SofLoadingGate label="Carregando…" />;
  }

  if (!employee) return <Redirect href="/login" />;
  if (!employee.canHandleHandoffs) {
    return <Redirect href="/(employee)/agenda" />;
  }

  if (loading) {
    return <SofLoadingGate label="Carregando atendimentos…" />;
  }

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Atendimentos"
        subtitle="Fila de clientes que precisam de ajuda humana. Assuma, responda pelo Sof e devolva à Sof quando terminar."
      />
      <HandoffInbox
        handoffs={handoffs}
        onHandoffsChange={setHandoffs}
        api={api}
        mode="employee"
        selfEmployeeId={employee.id}
        selfEmployeeColor={employee.color}
        macros={macros}
        liveMessage={liveMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
});
