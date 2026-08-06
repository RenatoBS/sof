import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
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
import type {
  Employee,
  HandoffMacro,
  WhatsappHandoff,
  WhatsappMessage,
} from '@/src/api/types';
import {
  SofButton,
  SofEmptyState,
  SofErrorBanner,
} from '@/src/components/ui';
import {
  fileToHandoffMedia,
  mediaKindLabel,
  type HandoffMediaAttachment,
} from '@/src/lib/handoff-media';
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
    media?: { mediaBase64?: string; mediaName?: string },
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
  /** Cor do profissional logado (modo employee — cards atribuídos a si). */
  selfEmployeeColor?: string;
  /** Lista de profissionais habilitados (para transferir no dashboard). */
  transferableEmployees?: Employee[];
  /** Macros ativas para inserir no composer. */
  macros?: HandoffMacro[];
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

/** Cor do profissional responsável (mesma lógica da Agenda). */
function assigneeColor(
  h: WhatsappHandoff,
  employees: Employee[],
  self?: { id?: string; color?: string },
): string | null {
  if (h.assigneeType !== 'employee' || !h.assignedEmployeeId) return null;
  const emp = employees.find((e) => e.id === h.assignedEmployeeId);
  if (emp?.color?.trim()) return emp.color.trim();
  if (
    self?.id &&
    self.color?.trim() &&
    h.assignedEmployeeId === self.id
  ) {
    return self.color.trim();
  }
  return null;
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
  selfEmployeeColor,
  transferableEmployees = [],
  macros = [],
  liveMessage,
}: Props) {
  const selfColorRef = useMemo(
    () => ({ id: selfEmployeeId, color: selfEmployeeColor }),
    [selfEmployeeId, selfEmployeeColor],
  );
  const activeMacros = useMemo(
    () => macros.filter((m) => m.active && m.body.trim()),
    [macros],
  );
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  /** Só mobile: listas recolhíveis para liberar espaço pro chat. */
  const [openExpanded, setOpenExpanded] = useState(true);
  const [resolvedExpanded, setResolvedExpanded] = useState(false);
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [attachment, setAttachment] = useState<HandoffMediaAttachment | null>(
    null,
  );
  const [attachBusy, setAttachBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    setMacrosOpen(false);
    setAttachment(null);
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  const insertMacro = useCallback((macro: HandoffMacro) => {
    const text = macro.body.trim();
    if (!text) return;
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
    setMacrosOpen(false);
  }, []);

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

  const pickAttachment = async (file: File | null | undefined) => {
    if (!file) return;
    setAttachBusy(true);
    setError('');
    try {
      const media = await fileToHandoffMedia(file);
      setAttachment(media);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível anexar.');
    } finally {
      setAttachBusy(false);
    }
  };

  const send = () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text && !attachment) return;
    const media = attachment
      ? { mediaBase64: attachment.dataUrl, mediaName: attachment.name }
      : undefined;
    void run('reply', async () => {
      const res = await api.reply(selected.id, text, media);
      setDraft('');
      setAttachment(null);
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
    selected?.contextJson &&
    (selected.contextJson.productName || selected.contextJson.productId)
      ? selected.contextJson
      : null;
  const selectedAssigneeColor = selected
    ? assigneeColor(selected, transferableEmployees, selfColorRef)
    : null;

  const queueItems = open;
  const enabledTransfer = transferableEmployees.filter(
    (e) => e.canHandleHandoffs,
  );

  const showOpenList = wide || openExpanded;
  const showResolvedList = wide || resolvedExpanded;
  const resolvedCountLabel = resolved.length ? `(${resolved.length})` : '';

  const resolvedSection =
    resolved.length > 0 ? (
      <View
        style={[styles.resolvedBlock, !wide && styles.resolvedBlockMobile]}
      >
        {wide ? (
          <Text style={styles.sectionTitleSmall}>
            Resolvidos {resolvedCountLabel}
          </Text>
        ) : (
          <Pressable
            onPress={() => setResolvedExpanded((v) => !v)}
            style={styles.sectionToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: resolvedExpanded }}
            accessibilityLabel={
              resolvedExpanded
                ? 'Recolher resolvidos'
                : 'Expandir resolvidos'
            }
          >
            <Text style={styles.sectionTitleSmallInline}>
              Resolvidos {resolvedCountLabel}
            </Text>
            <Text style={styles.sectionToggleAction}>
              {resolvedExpanded ? '▴ Recolher' : '▾ Expandir'}
            </Text>
          </Pressable>
        )}
        {showResolvedList ? (
          <View style={styles.queueListWrap}>
            <ScrollView
              style={styles.queueScrollCompactResolved}
              nestedScrollEnabled
            >
              {resolved.slice(0, 20).map((h) => {
                const color = assigneeColor(
                  h,
                  transferableEmployees,
                  selfColorRef,
                );
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => setSelectedId(h.id)}
                    style={[
                      styles.queueItem,
                      styles.queueItemCompact,
                      styles.queueItemResolved,
                      h.id === selectedId && styles.queueItemActive,
                      color ? { borderLeftColor: color } : null,
                    ]}
                  >
                    <Text style={styles.queueName} numberOfLines={1}>
                      {h.customerName || formatPhone(h.customerPhone)}
                    </Text>
                    <Text style={styles.queueMeta}>
                      {h.resolvedAt ? formatWhen(h.resolvedAt) : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {resolved.length > 3 ? (
              <Text style={styles.queueScrollHint}>Mais ↓</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    ) : null;

  return (
    <View style={[styles.root, wide && styles.rootWide]}>
      <View style={[styles.queue, wide && styles.queueWide]}>
        {wide ? (
          <Text style={styles.sectionTitle}>
            Abertos {queueItems.length ? `(${queueItems.length})` : ''}
          </Text>
        ) : (
          <Pressable
            onPress={() => setOpenExpanded((v) => !v)}
            style={styles.sectionToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: openExpanded }}
            accessibilityLabel={
              openExpanded ? 'Recolher abertos' : 'Expandir abertos'
            }
          >
            <Text style={styles.sectionTitle}>
              Abertos {queueItems.length ? `(${queueItems.length})` : ''}
            </Text>
            <Text style={styles.sectionToggleAction}>
              {openExpanded ? '▴ Recolher' : '▾ Expandir'}
            </Text>
          </Pressable>
        )}
        {showOpenList ? (
          queueItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <SofEmptyState
                title="Nenhum atendimento pendente"
                body="O bot está dando conta sozinho."
              />
            </View>
          ) : (
            <View style={styles.queueListWrap}>
              <ScrollView
                style={styles.queueScrollCompactOpen}
                nestedScrollEnabled
              >
                {queueItems.map((h) => {
                  const active = h.id === selectedId;
                  const color = assigneeColor(
                    h,
                    transferableEmployees,
                    selfColorRef,
                  );
                  return (
                    <Pressable
                      key={h.id}
                      onPress={() => {
                        setSelectedId(h.id);
                        setShowTransfer(false);
                      }}
                      style={[
                        styles.queueItem,
                        styles.queueItemCompact,
                        active && styles.queueItemActive,
                        h.party === 'employee' && !color
                          ? styles.queueItemEmployee
                          : null,
                        color ? { borderLeftColor: color } : null,
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
                    </Pressable>
                  );
                })}
              </ScrollView>
              {queueItems.length > 3 ? (
                <Text style={styles.queueScrollHint}>Mais ↓</Text>
              ) : null}
            </View>
          )
        ) : null}

        {wide ? resolvedSection : null}
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
              <Text
                style={[
                  styles.assigneeChip,
                  selectedAssigneeColor
                    ? {
                        borderColor: selectedAssigneeColor,
                        backgroundColor: `${selectedAssigneeColor}22`,
                        color: d.ink,
                      }
                    : null,
                ]}
              >
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
                  const caption =
                    m.body && m.body !== mediaKindLabel(m.mediaKind)
                      ? m.body
                      : '';
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
                      {m.mediaUrl && m.mediaKind === 'image' ? (
                        <Image
                          source={{ uri: m.mediaUrl }}
                          style={styles.bubbleMediaImage}
                          resizeMode="cover"
                        />
                      ) : null}
                      {m.mediaUrl &&
                      m.mediaKind === 'video' &&
                      Platform.OS === 'web'
                        ? createElement('video', {
                            src: m.mediaUrl,
                            controls: true,
                            style: {
                              width: '100%',
                              maxHeight: 220,
                              borderRadius: 8,
                              marginTop: 4,
                            },
                          })
                        : null}
                      {m.mediaUrl &&
                      m.mediaKind === 'audio' &&
                      Platform.OS === 'web'
                        ? createElement('audio', {
                            src: m.mediaUrl,
                            controls: true,
                            style: { width: '100%', marginTop: 4 },
                          })
                        : null}
                      {m.mediaUrl && m.mediaKind === 'document' ? (
                        <Pressable
                          onPress={() =>
                            Linking.openURL(m.mediaUrl!).catch(() => undefined)
                          }
                          style={styles.bubbleDoc}
                        >
                          <Text
                            style={[
                              styles.bubbleDocText,
                              mine && styles.bubbleBodyOut,
                            ]}
                          >
                            PDF · {m.mediaName || 'documento.pdf'}
                          </Text>
                        </Pressable>
                      ) : null}
                      {m.mediaUrl &&
                      (m.mediaKind === 'video' || m.mediaKind === 'audio') &&
                      Platform.OS !== 'web' ? (
                        <Text
                          style={[
                            styles.bubbleBody,
                            mine && styles.bubbleBodyOut,
                          ]}
                        >
                          {mediaKindLabel(m.mediaKind)}
                        </Text>
                      ) : null}
                      {caption ? (
                        <Text
                          style={[
                            styles.bubbleBody,
                            mine && styles.bubbleBodyOut,
                          ]}
                        >
                          {caption}
                        </Text>
                      ) : !m.mediaUrl ? (
                        <Text
                          style={[
                            styles.bubbleBody,
                            mine && styles.bubbleBodyOut,
                          ]}
                        >
                          {m.body}
                        </Text>
                      ) : null}
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
                  <>
                    {activeMacros.length > 0 ? (
                      <View style={styles.macroSelectWrap}>
                        <Text style={styles.macroSelectLabel}>Macro</Text>
                        {Platform.OS === 'web' ? (
                          createElement(
                            'select',
                            {
                              value: '',
                              disabled: Boolean(busy),
                              'aria-label': 'Inserir macro no texto',
                              onChange: (e: {
                                target: { value: string };
                              }) => {
                                const macro = activeMacros.find(
                                  (m) => m.id === e.target.value,
                                );
                                if (macro) insertMacro(macro);
                              },
                              style: {
                                width: '100%',
                                height: 40,
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: d.line,
                                borderRadius: 8,
                                paddingLeft: 10,
                                paddingRight: 10,
                                fontSize: 14,
                                color: d.ink,
                                backgroundColor: '#fff',
                                fontFamily: d.fonts.body,
                              },
                            },
                            createElement(
                              'option',
                              { value: '', disabled: true, hidden: true },
                              'Inserir macro…',
                            ),
                            ...activeMacros.map((macro) =>
                              createElement(
                                'option',
                                { key: macro.id, value: macro.id },
                                macro.title,
                              ),
                            ),
                          )
                        ) : (
                          <>
                            <Pressable
                              onPress={() => setMacrosOpen((v) => !v)}
                              style={styles.macroSelectButton}
                              disabled={Boolean(busy)}
                              accessibilityRole="button"
                              accessibilityState={{ expanded: macrosOpen }}
                            >
                              <Text style={styles.macroSelectButtonText}>
                                Inserir macro…
                              </Text>
                              <Text style={styles.macroSelectChevron}>
                                {macrosOpen ? '▲' : '▼'}
                              </Text>
                            </Pressable>
                            {macrosOpen ? (
                              <View style={styles.macroSelectList}>
                                {activeMacros.map((macro) => (
                                  <Pressable
                                    key={macro.id}
                                    onPress={() => insertMacro(macro)}
                                    style={styles.macroSelectOption}
                                    disabled={Boolean(busy)}
                                  >
                                    <Text
                                      style={styles.macroSelectOptionText}
                                      numberOfLines={1}
                                    >
                                      {macro.title}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                          </>
                        )}
                      </View>
                    ) : null}
                    {attachment ? (
                      <View style={styles.attachPreview}>
                        {attachment.kind === 'image' ? (
                          <Image
                            source={{ uri: attachment.dataUrl }}
                            style={styles.attachThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.attachMeta} numberOfLines={1}>
                            {mediaKindLabel(attachment.kind)} {attachment.name}
                          </Text>
                        )}
                        <Pressable
                          onPress={() => setAttachment(null)}
                          disabled={Boolean(busy)}
                        >
                          <Text style={styles.attachRemove}>Remover</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    <View style={styles.composerRow}>
                      <View style={styles.composerField}>
                        <TextInput
                          style={styles.input}
                          value={draft}
                          onChangeText={setDraft}
                          placeholder={
                            attachment
                              ? 'Legenda opcional…'
                              : 'Escreva a resposta…'
                          }
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
                      {Platform.OS === 'web' ? (
                        <>
                          {createElement('input', {
                            ref: (el: HTMLInputElement | null) => {
                              fileInputRef.current = el;
                            },
                            type: 'file',
                            accept:
                              'image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/*,application/pdf',
                            style: { display: 'none' },
                            onChange: (e: {
                              target: { files: FileList | null; value: string };
                            }) => {
                              const file = e.target.files?.[0];
                              void pickAttachment(file);
                              e.target.value = '';
                            },
                          })}
                          <SofButton
                            title="Anexar"
                            variant="light"
                            theme="dashboard"
                            loading={attachBusy}
                            disabled={Boolean(busy) || attachBusy}
                            onPress={() => fileInputRef.current?.click()}
                          />
                        </>
                      ) : null}
                      <SofButton
                        title="Enviar"
                        variant="dark"
                        theme="dashboard"
                        loading={busy === 'reply'}
                        disabled={
                          Boolean(busy) ||
                          (!draft.trim() && !attachment) ||
                          attachBusy
                        }
                        onPress={send}
                      />
                    </View>
                  </>
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

      {!wide && selected ? (
        <View style={[styles.context, styles.contextMobile]}>
          <Text style={styles.sectionTitleSmall}>Contexto</Text>
          {productContext ? (
            <View style={styles.contextProductBlock}>
              <Text style={styles.contextLabel}>Produto selecionado</Text>
              <Text style={styles.contextValue}>
                {productContext.productName || '—'}
                {productContext.quantity
                  ? ` · qtd ${productContext.quantity}`
                  : ''}
              </Text>
              {productContext.total != null ? (
                <Text style={styles.contextValue}>
                  {Number(productContext.total).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </Text>
              ) : null}
              {productContext.paymentLinkUrl ? (
                <Text style={styles.contextValueMono} numberOfLines={2}>
                  {productContext.paymentLinkUrl}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.contextLabel}>Motivo</Text>
          <Text style={styles.contextValue}>
            {REASON_LABEL[selected.reason] || selected.reason}
          </Text>
          <Text style={styles.contextLabel}>Responsável</Text>
          <Text style={styles.contextValue}>
            {assigneeLabel(selected, transferableEmployees)}
          </Text>
        </View>
      ) : null}

      {!wide ? resolvedSection : null}

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
            <View style={styles.contextProductBlock}>
              <Text style={styles.contextLabel}>Produto selecionado</Text>
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
              {productContext.paymentLinkUrl ? (
                <>
                  <Text style={styles.contextLabel}>Link de pagamento</Text>
                  <Text style={styles.contextValueMono} numberOfLines={3}>
                    {productContext.paymentLinkUrl}
                  </Text>
                </>
              ) : null}
            </View>
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
  queueListWrap: { gap: 4 },
  /** Viewport ~3 cards + scroll (desktop e mobile). */
  queueScrollCompactOpen: { maxHeight: 186 },
  queueScrollCompactResolved: { maxHeight: 168 },
  queueScrollHint: {
    fontSize: 11,
    fontWeight: '700',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
    paddingVertical: 4,
  },
  sectionToggleAction: {
    fontSize: 12,
    fontWeight: '700',
    color: d.accent,
    fontFamily: d.fonts.bodyMedium,
    flexShrink: 0,
  },
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
  sectionTitleSmallInline: {
    fontSize: 13,
    fontWeight: '700',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
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
    borderLeftWidth: 4,
    borderLeftColor: d.line,
    borderRadius: d.radiusSm,
    padding: 12,
    marginBottom: 8,
    backgroundColor: d.surface,
    gap: 4,
  },
  queueItemCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 2,
  },
  queueItemActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  queueItemEmployee: { borderLeftColor: '#c4b5fd' },
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
  resolvedBlockMobile: {
    marginTop: 0,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: d.surface,
    padding: 12,
  },
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
  bubbleMediaImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#e2e8f0',
  },
  bubbleDoc: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  bubbleDocText: {
    fontSize: 13,
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  bubbleTime: {
    fontSize: 10,
    color: d.muted,
    fontFamily: d.fonts.body,
    alignSelf: 'flex-end',
  },
  bubbleTimeOut: { color: 'rgba(255,255,255,0.65)' },
  attachPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: d.accentSoft,
  },
  attachThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  attachMeta: {
    flex: 1,
    fontSize: 13,
    color: d.ink,
    fontFamily: d.fonts.body,
  },
  attachRemove: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
    fontFamily: d.fonts.bodyMedium,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: d.line,
    padding: 12,
    gap: 10,
  },
  macroSelectWrap: { gap: 6 },
  macroSelectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  macroSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    minHeight: 40,
  },
  macroSelectButtonText: {
    fontSize: 14,
    color: d.muted,
    fontFamily: d.fonts.body,
  },
  macroSelectChevron: {
    fontSize: 10,
    color: d.muted,
    fontFamily: d.fonts.body,
  },
  macroSelectList: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: '#fff',
    overflow: 'hidden',
    maxHeight: 180,
  },
  macroSelectOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: d.line,
  },
  macroSelectOptionText: {
    fontSize: 14,
    color: d.ink,
    fontFamily: d.fonts.body,
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
  contextMobile: {
    width: '100%',
  },
  contextProductBlock: {
    marginTop: 4,
    marginBottom: 4,
    padding: 10,
    borderRadius: d.radiusSm,
    backgroundColor: d.accentSoft,
    borderWidth: 1,
    borderColor: d.line,
    gap: 2,
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
