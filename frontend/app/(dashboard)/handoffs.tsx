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
import { SofButton } from '@/src/components/ui';
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
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Atendimentos</Text>
          <Text style={styles.sub}>
            Conversas em que o bot precisou de ajuda humana — de clientes ou
            profissionais. Ao responder um cliente pelo WhatsApp, o bot pausa
            por 1 hora para aquele número e o alerta é resolvido. Resposta a
            profissional resolve o alerta sem pausar o bot operacional.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
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
        {settingsError ? (
          <Text style={styles.error}>{settingsError}</Text>
        ) : null}
      </View>

      <View>
        <Text style={styles.sectionTitle}>
          Abertos {open.length > 0 ? `(${open.length})` : ''}
        </Text>
        {open.length === 0 ? (
          <Text style={styles.empty}>
            Nenhum atendimento pendente — o bot está dando conta.
          </Text>
        ) : (
          <View style={styles.list}>
            {open.map((h) => (
              <View
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
                    title={resolvingId === h.id ? 'Resolvendo…' : 'Marcar resolvido'}
                    variant="light"
                    theme="dashboard"
                    disabled={resolvingId === h.id}
                    onPress={() => resolve(h.id)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {resolved.length > 0 ? (
        <View>
          <Text style={styles.sectionTitle}>Resolvidos recentes</Text>
          <View style={styles.list}>
            {resolved.map((h) => (
              <View
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
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8, maxWidth: 640 },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: d.ink },
  hint: { color: d.muted, fontSize: 13, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  chipText: { color: d.ink, fontSize: 13 },
  chipTextActive: { fontWeight: '700' },
  error: { color: d.danger, fontWeight: '600' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    marginBottom: 12,
  },
  empty: { color: d.muted, fontSize: 14 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entity: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 20,
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
  },
  partyBadgeClient: {
    color: '#1e40af',
    backgroundColor: '#dbeafe',
  },
  partyBadgeEmployee: {
    color: '#5b21b6',
    backgroundColor: '#ede9fe',
  },
  name: { fontSize: 17, fontWeight: '700', color: d.ink },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeHuman: {
    color: '#991b1b',
    backgroundColor: '#fee2e2',
  },
  badgeResolved: {
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
  meta: { color: d.muted, fontSize: 13 },
  message: { color: d.ink, fontSize: 14, lineHeight: 20 },
  messageMuted: { color: d.muted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
