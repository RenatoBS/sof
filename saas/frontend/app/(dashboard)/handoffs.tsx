import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { WhatsappHandoff } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofEmptyState,
  SofErrorBanner,
  SofPageHeader,
} from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';
import { useEntitlements } from '@/src/entitlements/useEntitlements';

const REASON_LABEL: Record<WhatsappHandoff['reason'], string> = {
  human_requested: 'Pediu atendente',
  unresolved: 'Bot não entendeu',
};

function whatsappUrl(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  // No navegador abre direto a conversa no WhatsApp Web; no celular, o app.
  if (Platform.OS === 'web') {
    return `https://web.whatsapp.com/send?phone=${digits}`;
  }
  return `https://wa.me/${digits}`;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HandoffsScreen() {
  const { has } = useEntitlements();
  const { handoffs, setHandoffs } = useDashboard();
  const [threshold, setThreshold] = useState<number | null>(null);
  const [allowed, setAllowed] = useState<number[]>([1, 2, 3, 5]);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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

  if (!has('handoffs')) return <Redirect href="/(dashboard)/agenda" />;

  const open = handoffs
    .filter((h) => h.status === 'open')
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const resolved = handoffs
    .filter((h) => h.status === 'resolved')
    .sort(
      (a, b) => (b.resolvedAt || b.openedAt).localeCompare(a.resolvedAt || a.openedAt),
    )
    .slice(0, 20);

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

  const resolve = async (id: string) => {
    setResolvingId(id);
    try {
      const { handoff } = await dashboardApi.resolveWhatsappHandoff(id);
      setHandoffs((prev) => prev.map((h) => (h.id === handoff.id ? handoff : h)));
    } catch {
      // SSE reenvia o estado real se algo falhar; sem ação extra aqui.
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Atendimentos"
        subtitle="Conversas em que o bot precisou de ajuda humana — de clientes ou profissionais. Ao responder um cliente pelo WhatsApp, o bot pausa por 1 hora para aquele número e o alerta é resolvido. Resposta a profissional resolve o alerta sem pausar o bot operacional."
      />

      <SofCard>
        <Text style={styles.cardTitle}>Configuração</Text>
        <Text style={styles.hint}>
          Quantas respostas "não entendi" seguidas do bot abrem um alerta aqui
          (vale para cliente e profissional). Pedidos explícitos por atendente
          sempre alertam na hora.
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

      <View>
        <Text style={styles.sectionTitle}>
          Abertos {open.length > 0 ? `(${open.length})` : ''}
        </Text>
        {open.length === 0 ? (
          <SofCard padded={false}>
            <SofEmptyState
              title="Nenhum atendimento pendente"
              body="O bot está dando conta sozinho."
            />
          </SofCard>
        ) : (
          <View style={styles.list}>
            {open.map((h) => (
              <SofCard
                key={h.id}
                style={[
                  styles.entity,
                  h.party === 'employee' && styles.entityEmployee,
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.nameBlock}>
                    <Text
                      style={[
                        styles.partyBadge,
                        h.party === 'employee'
                          ? styles.partyBadgeEmployee
                          : styles.partyBadgeClient,
                      ]}
                    >
                      {h.party === 'employee' ? 'Profissional' : 'Cliente'}
                    </Text>
                    <Text style={styles.name}>
                      {h.customerName || formatPhone(h.customerPhone)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.badge,
                      h.reason === 'human_requested' && styles.badgeHuman,
                    ]}
                  >
                    {REASON_LABEL[h.reason]}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {formatPhone(h.customerPhone)} · desde {formatWhen(h.openedAt)}
                </Text>
                {h.lastMessage ? (
                  <Text style={styles.message} numberOfLines={3}>
                    “{h.lastMessage}”
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <SofButton
                    title="Abrir no WhatsApp"
                    variant="dark"
                    theme="dashboard"
                    onPress={() => {
                      Linking.openURL(whatsappUrl(h.customerPhone)).catch(
                        () => undefined,
                      );
                    }}
                  />
                  <SofButton
                    title="Marcar resolvido"
                    variant="light"
                    theme="dashboard"
                    loading={resolvingId === h.id}
                    disabled={resolvingId === h.id}
                    onPress={() => resolve(h.id)}
                  />
                </View>
              </SofCard>
            ))}
          </View>
        )}
      </View>

      {resolved.length > 0 ? (
        <View>
          <Text style={styles.sectionTitle}>Resolvidos recentes</Text>
          <View style={styles.list}>
            {resolved.map((h) => (
              <SofCard
                key={h.id}
                style={[
                  styles.entity,
                  styles.entityResolved,
                  h.party === 'employee' && styles.entityEmployee,
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.nameBlock}>
                    <Text
                      style={[
                        styles.partyBadge,
                        h.party === 'employee'
                          ? styles.partyBadgeEmployee
                          : styles.partyBadgeClient,
                      ]}
                    >
                      {h.party === 'employee' ? 'Profissional' : 'Cliente'}
                    </Text>
                    <Text style={styles.name}>
                      {h.customerName || formatPhone(h.customerPhone)}
                    </Text>
                  </View>
                  <Text style={[styles.badge, styles.badgeResolved]}>
                    {h.humanRepliedAt ? 'Respondido no WhatsApp' : 'Resolvido'}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {formatPhone(h.customerPhone)}
                  {h.resolvedAt ? ` · ${formatWhen(h.resolvedAt)}` : ''}
                </Text>
                {h.lastMessage ? (
                  <Text style={styles.messageMuted} numberOfLines={2}>
                    “{h.lastMessage}”
                  </Text>
                ) : null}
              </SofCard>
            ))}
          </View>
        </View>
      ) : null}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    marginBottom: 12,
  },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entity: {
    width: 340,
    maxWidth: '100%',
    gap: 8,
  },
  entityEmployee: {
    borderColor: '#c4b5fd',
    backgroundColor: '#f5f3ff',
  },
  entityResolved: { opacity: 0.75 },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nameBlock: { flex: 1, minWidth: 140, gap: 6 },
  partyBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    fontFamily: d.fonts.bodyMedium,
  },
  partyBadgeClient: {
    color: '#1e40af',
    backgroundColor: '#dbeafe',
  },
  partyBadgeEmployee: {
    color: '#5b21b6',
    backgroundColor: '#ede9fe',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    fontFamily: d.fonts.bodyMedium,
  },
  badgeHuman: {
    color: '#991b1b',
    backgroundColor: d.dangerSoft,
  },
  badgeResolved: {
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
  meta: { color: d.muted, fontSize: 13, fontFamily: d.fonts.body },
  message: { color: d.ink, fontSize: 14, lineHeight: 20, fontFamily: d.fonts.body },
  messageMuted: {
    color: d.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: d.fonts.body,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
});
