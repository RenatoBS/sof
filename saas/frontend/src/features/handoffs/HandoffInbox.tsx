import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Employee, WhatsappHandoff, WhatsappMessage } from '@/src/api/types';
import {
  SofButton,
  SofEmptyState,
  SofErrorBanner,
} from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';
import { formatPhone } from '@/src/context/DashboardContext';

const REASON_LABEL: Record<string, string> = {
  human_requested: 'Pediu atendente',
  unresolved: 'Bot não entendeu',
  product_sale: 'Venda de produto',
};

const SENDER_LABEL: Record<string, string> = {
  client: 'Cliente',
  employee_party: 'Profissional',
  bot: 'Sof',
  human_wa: 'WhatsApp',
  agent: 'Equipe',
};

export type HandoffInboxApi = {
  messages: (id: string) => Promise<{ messages: WhatsappMessage[] }>;
  reply: (
    id: string,
    text: string,
  ) => Promise<{ handoff: WhatsappHandoff | null; message: WhatsappMessage | null }>;
  claim: (id: string) => Promise<{ handoff: WhatsappHandoff }>;
  transfer: (
    id: string,
    body: { assigneeType: 'account' | 'employee'; employeeId?: string },
  ) => Promise<{ handoff: WhatsappHandoff }>;
  release: (id: string) => Promise<{ handoff: WhatsappHandoff }>;
  resolve: (id: string) => Promise<{ handoff: WhatsappHandoff }>;
  returnToSof: (id: string) => Promise<{ handoff: WhatsappHandoff }>;
};

type Props = {
  handoffs: WhatsappHandoff[];
  onHandoffsChange: (
    updater: (prev: WhatsappHandoff[]) => WhatsappHandoff[],
  ) => void;
  api: HandoffInboxApi;
  /** Dono da conta (dashboard) ou sessão do profissional. */
  mode: 'account' | 'employee';
  /** Id do profissional logado (modo employee). */
  selfEmployeeId?: string;
  /** Lista de profissionais habilitados (para transferir no dashboard). */
  transferableEmployees?: Employee[];
  /** Mensagem SSE nova — pai passa quando chega whatsapp-handoff:message. */
  liveMessage?: { handoffId: string; message: WhatsappMessage } | null;
};

function whatsappUrl(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
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

function assigneeLabel(
  h: WhatsappHandoff,
  employees: Employee[],
): string {
  if (!h.assigneeType) return 'Na fila';
  if (h.assigneeType === 'account') return 'Dono da conta';
  const emp = employees.find((e) => e.id === h.assignedEmployeeId);
  return emp?.name || 'Profissional';
}

function isMine(
  h: WhatsappHandoff,
  mode: 'account' | 'employee',
  selfEmployeeId?: string,
) {
  if (mode === 'account') return h.assigneeType === 'account';
  return (
    h.assigneeType === 'employee' && h.assignedEmployeeId === selfEmployeeId
  );
}

function canCompose(
  h: WhatsappHandoff,
  mode: 'account' | 'employee',
  selfEmployeeId?: string,
) {
  if (h.status !== 'open') return false;
  if (!h.assigneeType) return true; // reply auto-claims
  return isMine(h, mode, selfEmployeeId);
}

export function HandoffInbox({
  handoffs,
  onHandoffsChange,
  api,
  mode,
  selfEmployeeId,
  transferableEmployees = [],
  liveMessage,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const open = useMemo(
    () =>
      handoffs
        .filter((h) => h.status === 'open')
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    [handoffs],
  );
  const resolved = useMemo(
    () =>
      handoffs
        .filter((h) => h.status === 'resolved')
        .sort(
          (a, b) =>
            (b.resolvedAt || b.openedAt).localeCompare(
              a.resolvedAt || a.openedAt,
            ),
        )
        .slice(0, 20),
    [handoffs],
  );

  const selected = handoffs.find((h) => h.id === selectedId) || null;

  const patchHandoff = useCallback(
    (handoff: WhatsappHandoff) => {
      onHandoffsChange((prev) => {
        const idx = prev.findIndex((h) => h.id === handoff.id);
        if (idx < 0) return [handoff, ...prev];
        const next = [...prev];
        next[idx] = handoff;
        return next;
      });
    },
    [onHandoffsChange],
  );

  const loadMessages = useCallback(
    async (id: string) => {
      setLoadingMessages(true);
      setError('');
      try {
        const res = await api.messages(id);
        setMessages(res.messages);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Não foi possível carregar a conversa.',
        );
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (!liveMessage) return;
    if (liveMessage.handoffId !== selectedId) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === liveMessage.message.id)) return prev;
      return [...prev, liveMessage.message];
    });
  }, [liveMessage, selectedId]);

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir.');
    } finally {
      setBusy('');
    }
  };

  const send = () => {
    if (!selected || !draft.trim()) return;
    const text = draft.trim();
    void run('reply', async () => {
      const res = await api.reply(selected.id, text);
      setDraft('');
      if (res.handoff) patchHandoff(res.handoff);
      if (res.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === res.message!.id)
            ? prev
            : [...prev, res.message!],
        );
      }
    });
  };

  const onComposerKey = (event: {
    key?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault?: () => void;
    nativeEvent?: { key?: string; ctrlKey?: boolean; metaKey?: boolean };
  }) => {
    const key = event.key || event.nativeEvent?.key;
    const ctrl = Boolean(event.ctrlKey ?? event.nativeEvent?.ctrlKey);
    const meta = Boolean(event.metaKey ?? event.nativeEvent?.metaKey);
    if (key === 'Enter' && (ctrl || meta)) {
      event.preventDefault?.();
      send();
    }
  };

  const productContext =
    selected?.reason === 'product_sale' && selected.contextJson
      ? selected.contextJson
      : null;

  const queueItems = open;
  const enabledTransfer = transferableEmployees.filter(
    (e) => e.canHandleHandoffs,
  );

  return (
    <View style={[styles.root, wide && styles.rootWide]}>
      <View style={[styles.queue, wide && styles.queueWide]}>
        <Text style={styles.sectionTitle}>
          Abertos {queueItems.length ? `(${queueItems.length})` : ''}
        </Text>
        {queueItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <SofEmptyState
              title="Nenhum atendimento pendente"
              body="O bot está dando conta sozinho."
            />
          </View>
        ) : (
          <ScrollView style={styles.queueScroll}>
            {queueItems.map((h) => {
              const active = h.id === selectedId;
              return (
                <Pressable
                  key={h.id}
                  onPress={() => {
                    setSelectedId(h.id);
                    setShowTransfer(false);
                  }}
                  style={[
                    styles.queueItem,
                    active && styles.queueItemActive,
                    h.party === 'employee' && styles.queueItemEmployee,
                  ]}
                >
                  <View style={styles.queueTop}>
                    <Text style={styles.queueName} numberOfLines={1}>
                      {h.customerName || formatPhone(h.customerPhone)}
                    </Text>
                    <Text style={styles.queueReason}>
                      {REASON_LABEL[h.reason] || h.reason}
                    </Text>
                  </View>
                  <Text style={styles.queueMeta} numberOfLines={1}>
                    {assigneeLabel(h, transferableEmployees)} ·{' '}
                    {formatWhen(h.openedAt)}
                  </Text>
                  {h.lastMessage ? (
                    <Text style={styles.queuePreview} numberOfLines={2}>
                      {h.lastMessage}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {resolved.length > 0 ? (
          <View style={styles.resolvedBlock}>
            <Text style={styles.sectionTitleSmall}>Resolvidos</Text>
            {resolved.slice(0, 8).map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setSelectedId(h.id)}
                style={[
                  styles.queueItem,
                  styles.queueItemResolved,
                  h.id === selectedId && styles.queueItemActive,
                ]}
              >
                <Text style={styles.queueName} numberOfLines={1}>
                  {h.customerName || formatPhone(h.customerPhone)}
                </Text>
                <Text style={styles.queueMeta}>
                  {h.resolvedAt ? formatWhen(h.resolvedAt) : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.thread, wide && styles.threadWide]}>
        {!selected ? (
          <View style={styles.threadEmpty}>
            <Text style={styles.threadEmptyText}>
              Selecione um atendimento na fila.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.threadHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.threadTitle} numberOfLines={1}>
                  {selected.customerName || formatPhone(selected.customerPhone)}
                </Text>
                <Text style={styles.threadSub}>
                  {formatPhone(selected.customerPhone)} ·{' '}
                  {selected.party === 'employee' ? 'Profissional' : 'Cliente'}
                </Text>
              </View>
              <Text style={styles.assigneeChip}>
                {assigneeLabel(selected, transferableEmployees)}
              </Text>
            </View>

            {productContext?.productName ? (
              <View style={styles.productBanner}>
                <Text style={styles.productBannerLabel}>Produto selecionado</Text>
                <Text style={styles.productBannerValue}>
                  {productContext.productName}
                  {productContext.quantity
                    ? ` · qtd ${productContext.quantity}`
                    : ''}
                  {productContext.total != null
                    ? ` · ${Number(productContext.total).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}`
                    : ''}
                </Text>
              </View>
            ) : null}

            {error ? <SofErrorBanner message={error} /> : null}

            <ScrollView
              ref={scrollRef}
              style={styles.bubbles}
              contentContainerStyle={styles.bubblesContent}
            >
              {loadingMessages ? (
                <Text style={styles.muted}>Carregando conversa…</Text>
              ) : messages.length === 0 ? (
                <Text style={styles.muted}>Sem mensagens ainda.</Text>
              ) : (
                messages.map((m) => {
                  const mine =
                    m.senderKind === 'agent' || m.senderKind === 'human_wa';
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleOut : styles.bubbleIn,
                      ]}
                    >
                      <Text style={styles.bubbleSender}>
                        {m.sentByAccountOwner
                          ? 'Dono'
                          : SENDER_LABEL[m.senderKind] || m.senderKind}
                      </Text>
                      <Text
                        style={[
                          styles.bubbleBody,
                          mine && styles.bubbleBodyOut,
                        ]}
                      >
                        {m.body}
                      </Text>
                      <Text
                        style={[
                          styles.bubbleTime,
                          mine && styles.bubbleTimeOut,
                        ]}
                      >
                        {formatWhen(m.createdAt)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {selected.status === 'open' ? (
              <View style={styles.composer}>
                <View style={styles.actionsRow}>
                  {!selected.assigneeType ? (
                    <SofButton
                      title="Assumir"
                      variant="dark"
                      theme="dashboard"
                      loading={busy === 'claim'}
                      disabled={Boolean(busy)}
                      onPress={() =>
                        void run('claim', async () => {
                          const { handoff } = await api.claim(selected.id);
                          patchHandoff(handoff);
                        })
                      }
                    />
                  ) : null}
                  {isMine(selected, mode, selfEmployeeId) ? (
                    <SofButton
                      title="Liberar"
                      variant="light"
                      theme="dashboard"
                      loading={busy === 'release'}
                      disabled={Boolean(busy)}
                      onPress={() =>
                        void run('release', async () => {
                          const { handoff } = await api.release(selected.id);
                          patchHandoff(handoff);
                        })
                      }
                    />
                  ) : null}
                  {mode === 'account' ||
                  isMine(selected, mode, selfEmployeeId) ? (
                    <SofButton
                      title="Transferir"
                      variant="light"
                      theme="dashboard"
                      disabled={Boolean(busy)}
                      onPress={() => setShowTransfer((v) => !v)}
                    />
                  ) : null}
                  <SofButton
                    title="Resolver"
                    variant="light"
                    theme="dashboard"
                    loading={busy === 'resolve'}
                    disabled={Boolean(busy)}
                    onPress={() =>
                      void run('resolve', async () => {
                        const { handoff } = await api.resolve(selected.id);
                        patchHandoff(handoff);
                      })
                    }
                  />
                  {selected.party === 'client' ? (
                    <SofButton
                      title="Devolver à Sof"
                      variant="light"
                      theme="dashboard"
                      loading={busy === 'return'}
                      disabled={Boolean(busy)}
                      onPress={() =>
                        void run('return', async () => {
                          const { handoff } = await api.returnToSof(
                            selected.id,
                          );
                          patchHandoff(handoff);
                        })
                      }
                    />
                  ) : null}
                </View>

                {showTransfer ? (
                  <View style={styles.transferBox}>
                    {mode === 'employee' || mode === 'account' ? (
                      <Pressable
                        style={styles.transferOption}
                        onPress={() =>
                          void run('transfer', async () => {
                            const { handoff } = await api.transfer(
                              selected.id,
                              { assigneeType: 'account' },
                            );
                            patchHandoff(handoff);
                            setShowTransfer(false);
                          })
                        }
                      >
                        <Text style={styles.transferText}>Dono da conta</Text>
                      </Pressable>
                    ) : null}
                    {enabledTransfer
                      .filter((e) => e.id !== selfEmployeeId)
                      .map((e) => (
                        <Pressable
                          key={e.id}
                          style={styles.transferOption}
                          onPress={() =>
                            void run('transfer', async () => {
                              const { handoff } = await api.transfer(
                                selected.id,
                                {
                                  assigneeType: 'employee',
                                  employeeId: e.id,
                                },
                              );
                              patchHandoff(handoff);
                              setShowTransfer(false);
                            })
                          }
                        >
                          <Text style={styles.transferText}>{e.name}</Text>
                        </Pressable>
                      ))}
                  </View>
                ) : null}

                {canCompose(selected, mode, selfEmployeeId) ? (
                  <View style={styles.composerRow}>
                    <View style={styles.composerField}>
                      <TextInput
                        style={styles.input}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Escreva a resposta…"
                        placeholderTextColor={d.muted}
                        multiline
                        editable={!busy}
                        onSubmitEditing={send}
                        // Web: Ctrl/Cmd+Enter envia (Enter sozinho = nova linha).
                        // @ts-expect-error onKeyDown existe no RN Web
                        onKeyDown={onComposerKey}
                        onKeyPress={onComposerKey}
                      />
                      <Text style={styles.composerHint}>
                        Ctrl+Enter para enviar
                      </Text>
                    </View>
                    <SofButton
                      title="Enviar"
                      variant="dark"
                      theme="dashboard"
                      loading={busy === 'reply'}
                      disabled={Boolean(busy) || !draft.trim()}
                      onPress={send}
                    />
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    Assuma o atendimento para responder por aqui.
                  </Text>
                )}
              </View>
            ) : null}
          </>
        )}
      </View>

      {wide && selected ? (
        <View style={styles.context}>
          <Text style={styles.sectionTitleSmall}>Contexto</Text>
          <Text style={styles.contextLabel}>Nome</Text>
          <Text style={styles.contextValue}>
            {selected.customerName || '—'}
          </Text>
          <Text style={styles.contextLabel}>Telefone</Text>
          <Text style={styles.contextValue}>
            {formatPhone(selected.customerPhone)}
          </Text>
          <Text style={styles.contextLabel}>Motivo</Text>
          <Text style={styles.contextValue}>
            {REASON_LABEL[selected.reason] || selected.reason}
          </Text>
          {productContext ? (
            <>
              <Text style={styles.contextLabel}>Produto</Text>
              <Text style={styles.contextValue}>
                {productContext.productName || '—'}
                {productContext.quantity
                  ? ` · qtd ${productContext.quantity}`
                  : ''}
              </Text>
              {productContext.total != null ? (
                <>
                  <Text style={styles.contextLabel}>Total do pedido</Text>
                  <Text style={styles.contextValue}>
                    {Number(productContext.total).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </Text>
                </>
              ) : null}
              {productContext.orderId ? (
                <>
                  <Text style={styles.contextLabel}>Pedido</Text>
                  <Text style={styles.contextValueMono}>
                    {String(productContext.orderId).slice(0, 12)}…
                  </Text>
                </>
              ) : null}
            </>
          ) : null}
          <Text style={styles.contextLabel}>Responsável</Text>
          <Text style={styles.contextValue}>
            {assigneeLabel(selected, transferableEmployees)}
          </Text>
          <Text style={styles.contextLabel}>Desde</Text>
          <Text style={styles.contextValue}>
            {formatWhen(selected.openedAt)}
          </Text>
          <SofButton
            title="Abrir no WhatsApp"
            variant="light"
            theme="dashboard"
            onPress={() => {
              Linking.openURL(whatsappUrl(selected.customerPhone)).catch(
                () => undefined,
              );
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, minHeight: 480 },
  rootWide: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  queue: { gap: 8 },
  queueWide: { width: 280, flexShrink: 0 },
  queueScroll: { maxHeight: 420 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
  },
  sectionTitleSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: d.surface,
    overflow: 'hidden',
  },
  queueItem: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    padding: 12,
    marginBottom: 8,
    backgroundColor: d.surface,
    gap: 4,
  },
  queueItemActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  queueItemEmployee: { borderColor: '#c4b5fd' },
  queueItemResolved: { opacity: 0.7 },
  queueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'flex-start',
  },
  queueName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  queueReason: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    fontFamily: d.fonts.bodyMedium,
  },
  queueMeta: { color: d.muted, fontSize: 11, fontFamily: d.fonts.body },
  queuePreview: {
    color: d.ink,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: d.fonts.body,
  },
  resolvedBlock: { marginTop: 12, gap: 4 },
  thread: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: d.surface,
    minHeight: 420,
    overflow: 'hidden',
  },
  threadWide: { flex: 1 },
  threadEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  threadEmptyText: {
    color: d.muted,
    fontFamily: d.fonts.body,
    fontSize: 14,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  threadSub: { color: d.muted, fontSize: 12, fontFamily: d.fonts.body },
  assigneeChip: {
    fontSize: 11,
    fontWeight: '700',
    color: d.ink,
    backgroundColor: d.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontFamily: d.fonts.bodyMedium,
  },
  bubbles: { flex: 1, maxHeight: 360 },
  bubblesContent: { padding: 14, gap: 10 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f4',
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: d.ink,
  },
  bubbleSender: {
    fontSize: 10,
    fontWeight: '700',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
    textTransform: 'uppercase',
  },
  bubbleBody: {
    fontSize: 14,
    lineHeight: 20,
    color: d.ink,
    fontFamily: d.fonts.body,
  },
  bubbleBodyOut: { color: '#fff' },
  bubbleTime: {
    fontSize: 10,
    color: d.muted,
    fontFamily: d.fonts.body,
    alignSelf: 'flex-end',
  },
  bubbleTimeOut: { color: 'rgba(255,255,255,0.65)' },
  composer: {
    borderTopWidth: 1,
    borderTopColor: d.line,
    padding: 12,
    gap: 10,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  composerField: { flex: 1, gap: 4 },
  composerHint: {
    fontSize: 11,
    color: d.muted,
    fontFamily: d.fonts.body,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: d.ink,
    fontFamily: d.fonts.body,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  transferBox: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    overflow: 'hidden',
  },
  transferOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  transferText: {
    color: d.ink,
    fontSize: 14,
    fontFamily: d.fonts.body,
  },
  muted: { color: d.muted, fontSize: 13, fontFamily: d.fonts.body },
  context: {
    width: 220,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: d.surface,
    padding: 14,
    gap: 6,
  },
  contextLabel: {
    fontSize: 11,
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  contextValue: {
    fontSize: 14,
    color: d.ink,
    fontFamily: d.fonts.body,
  },
  contextValueMono: {
    fontSize: 12,
    color: d.ink,
    fontFamily: d.fonts.body,
    opacity: 0.8,
  },
  productBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: d.radiusSm,
    backgroundColor: d.accentSoft,
    borderWidth: 1,
    borderColor: d.line,
    gap: 2,
  },
  productBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  productBannerValue: {
    fontSize: 14,
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
    fontWeight: '600',
  },
});
