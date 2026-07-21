import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { dashboardApi } from '@/src/api/endpoints';
import type { DaySchedule, OpeningHours } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

const DAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

const REMINDER_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'Desativado' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 180, label: '3h' },
  { minutes: 360, label: '6h' },
  { minutes: 1440, label: '24h' },
];

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília (SP, RJ, MG, PR, SC, RS…)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (CE, PI, RN, PB, AL, SE)' },
  { value: 'America/Recife', label: 'Recife (PE)' },
  { value: 'America/Bahia', label: 'Bahia (BA)' },
  { value: 'America/Belem', label: 'Belém (PA, AP, MA)' },
  { value: 'America/Manaus', label: 'Manaus (AM)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (MT)' },
  { value: 'America/Campo_Grande', label: 'Campo Grande (MS)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (RO)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (RR)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (AC)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
];

const DEFAULT_HOURS: OpeningHours = [
  { open: false, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
];

type PairingMode = 'idle' | 'qrcode' | 'paircode';

function normalizeHours(raw: OpeningHours | undefined | null): OpeningHours {
  if (!Array.isArray(raw) || raw.length !== 7) {
    return DEFAULT_HOURS.map((day) => ({ ...day }));
  }
  return raw.map((day, idx) => ({
    open: Boolean(day?.open),
    start: day?.start || DEFAULT_HOURS[idx].start,
    end: day?.end || DEFAULT_HOURS[idx].end,
  }));
}

function sameSchedule(a: DaySchedule, b: DaySchedule) {
  if (a.open !== b.open) return false;
  if (!a.open) return true;
  return a.start === b.start && a.end === b.end;
}

/** Resume agrupando dias consecutivos com o mesmo expediente. */
function formatHoursSummary(hours: OpeningHours): string {
  const parts: string[] = [];
  let i = 0;
  while (i < hours.length) {
    let j = i + 1;
    while (j < hours.length && sameSchedule(hours[i], hours[j])) j += 1;
    const label =
      j === i + 1
        ? DAY_SHORT[i]
        : `${DAY_SHORT[i]}–${DAY_SHORT[j - 1]}`;
    const day = hours[i];
    parts.push(
      day.open ? `${label} ${day.start}–${day.end}` : `${label} fechado`,
    );
    i = j;
  }
  return parts.join(' · ');
}

export default function AccountScreen() {
  const { account, logout, setSession } = useAuth();
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [integrations, setIntegrations] = useState({
    wa: false,
    pairingAvailable: false,
  });
  const [hoursSaved, setHoursSaved] = useState('');
  const [hoursError, setHoursError] = useState('');
  const [savingHours, setSavingHours] = useState(false);

  const [address, setAddress] = useState('');
  const [addressSaved, setAddressSaved] = useState('');
  const [addressError, setAddressError] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const [reminderMinutes, setReminderMinutes] = useState(120);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [reminderSaved, setReminderSaved] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);

  const [waMode, setWaMode] = useState<PairingMode>('idle');
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waLinked, setWaLinked] = useState(false);
  const [waInstanceId, setWaInstanceId] = useState('');
  const [waQrcode, setWaQrcode] = useState<string | null>(null);
  const [waPaircode, setWaPaircode] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState('');
  const [waBusy, setWaBusy] = useState(false);
  const [waError, setWaError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshWaStatus = useCallback(async () => {
    try {
      const data = await dashboardApi.whatsappStatus();
      setWaStatus(data.status);
      setWaLinked(data.linked);
      setWaInstanceId(data.instanceId || '');
      if (data.qrcode) setWaQrcode(data.qrcode);
      if (data.paircode) setWaPaircode(data.paircode);
      if (data.linked) {
        stopPolling();
        setWaMode('idle');
        setWaQrcode(null);
        setWaPaircode(null);
      }
      return data;
    } catch {
      return null;
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => {
      void refreshWaStatus();
    }, 2500);
  }, [refreshWaStatus, stopPolling]);

  useEffect(() => {
    if (account) {
      setHours(normalizeHours(account.openingHours));
      setAddress(account.address || '');
      const lead = Number(account.whatsappReminderMinutes);
      setReminderMinutes(
        Number.isFinite(lead) &&
          REMINDER_PRESETS.some((p) => p.minutes === lead)
          ? lead
          : 120,
      );
      setTimezone(account.timezone || 'America/Sao_Paulo');
    }
    dashboardApi.integrations().then((data) => {
      setIntegrations({
        wa: data.whatsapp.configured,
        pairingAvailable: Boolean(data.whatsapp.pairingAvailable),
      });
      setWaLinked(Boolean(data.whatsapp.linked));
      setWaInstanceId(data.whatsapp.linkedPhoneNumberId || '');
    });
    if (account?.whatsappConnectedAt) {
      setWaLinked(true);
      setWaStatus('connected');
    }
    return () => stopPolling();
  }, [account, stopPolling]);

  useEffect(() => {
    if (!integrations.pairingAvailable) return;
    void refreshWaStatus();
  }, [integrations.pairingAvailable, refreshWaStatus]);

  if (!account) return null;

  const since = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString('pt-BR')
    : '—';

  const patchDay = (index: number, patch: Partial<DaySchedule>) => {
    setHours((prev) =>
      prev.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
  };

  const connectQr = async () => {
    setWaError('');
    setWaBusy(true);
    setWaMode('qrcode');
    setWaPaircode(null);
    try {
      const data = await dashboardApi.connectWhatsapp();
      setWaStatus(data.status);
      setWaInstanceId(data.instanceId || '');
      setWaQrcode(data.qrcode || null);
      startPolling();
    } catch (err) {
      setWaError(
        err instanceof Error ? err.message : 'Não foi possível gerar o QR.',
      );
      setWaMode('idle');
    } finally {
      setWaBusy(false);
    }
  };

  const connectPair = async () => {
    setWaError('');
    const digits = waPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setWaError('Informe o telefone com DDI (ex: 5511999998888).');
      return;
    }
    setWaBusy(true);
    setWaMode('paircode');
    setWaQrcode(null);
    try {
      const data = await dashboardApi.connectWhatsapp({ phone: digits });
      setWaStatus(data.status);
      setWaInstanceId(data.instanceId || '');
      setWaPaircode(data.paircode || null);
      startPolling();
    } catch (err) {
      setWaError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o código.',
      );
      setWaMode('idle');
    } finally {
      setWaBusy(false);
    }
  };

  const disconnectWa = async () => {
    setWaError('');
    setWaBusy(true);
    stopPolling();
    try {
      await dashboardApi.disconnectWhatsapp();
      setWaLinked(false);
      setWaStatus('disconnected');
      setWaMode('idle');
      setWaQrcode(null);
      setWaPaircode(null);
    } catch (err) {
      setWaError(
        err instanceof Error ? err.message : 'Falha ao desconectar.',
      );
    } finally {
      setWaBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <View>
        <Text style={styles.h2}>Sua conta</Text>
        <Text style={styles.sub}>Plano, horários, credenciais e integrações</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assinatura</Text>
        <View style={styles.metaGrid}>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Plano</Text>
            <Text style={styles.metaValue}>
              {account.plan}
              {account.planPrice != null ? ` — R$ ${account.planPrice}` : ''}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>E-mail</Text>
            <Text style={styles.metaValue}>{account.email}</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Assinante desde</Text>
            <Text style={styles.metaValue}>{since}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Endereço</Text>
        <Text style={[styles.help, { marginBottom: 12 }]}>
          Opcional. O bot do WhatsApp pode informar o endereço quando o cliente
          perguntar (ex.: “onde fica?”).
        </Text>
        <SofInput
          label="Endereço do estabelecimento"
          value={address}
          onChangeText={setAddress}
          theme="dashboard"
          placeholder="Rua Exemplo, 123 — Bairro, Cidade"
          autoCapitalize="words"
        />
        {addressError ? <Text style={styles.error}>{addressError}</Text> : null}
        {addressSaved ? <Text style={styles.saved}>{addressSaved}</Text> : null}
        <SofButton
          title={savingAddress ? 'Salvando…' : 'Salvar endereço'}
          variant="dark"
          theme="dashboard"
          disabled={savingAddress}
          onPress={async () => {
            setAddressError('');
            setSavingAddress(true);
            try {
              const { account: updated } = await dashboardApi.updateAccount({
                address: address.trim(),
              });
              await setSession(updated);
              setAddressSaved('Endereço salvo!');
              setTimeout(() => setAddressSaved(''), 2000);
            } catch (err) {
              setAddressError(
                err instanceof Error
                  ? err.message
                  : 'Não foi possível salvar.',
              );
            } finally {
              setSavingAddress(false);
            }
          }}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.hoursHeader}>
          <Text style={styles.cardTitle}>Horário de funcionamento</Text>
          <Pressable
            onPress={() => setHoursExpanded((prev) => !prev)}
            style={styles.expandBtn}
            accessibilityRole="button"
            accessibilityState={{ expanded: hoursExpanded }}
          >
            <Text style={styles.expandBtnText}>
              {hoursExpanded ? 'Recolher' : 'Editar'}
            </Text>
          </Pressable>
        </View>

        {!hoursExpanded ? (
          <Text style={styles.hoursSummary}>{formatHoursSummary(hours)}</Text>
        ) : (
          <>
            <Text style={[styles.help, { marginBottom: 8 }]}>
              Define os dias e horários em que clientes podem agendar (WhatsApp e
              painel). O serviço precisa caber inteiro dentro do expediente.
            </Text>
            {hours.map((day, index) => (
              <View key={DAY_LABELS[index]} style={styles.dayRow}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayLabel}>{DAY_LABELS[index]}</Text>
                  <Pressable
                    onPress={() => patchDay(index, { open: !day.open })}
                    style={[
                      styles.toggle,
                      day.open ? styles.toggleOn : styles.toggleOff,
                    ]}
                  >
                    <Text style={styles.toggleText}>
                      {day.open ? 'Aberto' : 'Fechado'}
                    </Text>
                  </Pressable>
                </View>
                {day.open ? (
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <SofInput
                        label="Abre"
                        value={day.start}
                        onChangeText={(start) => patchDay(index, { start })}
                        theme="dashboard"
                        placeholder="09:00"
                      />
                    </View>
                    <View style={styles.timeField}>
                      <SofInput
                        label="Fecha"
                        value={day.end}
                        onChangeText={(end) => patchDay(index, { end })}
                        theme="dashboard"
                        placeholder="18:00"
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
            {hoursError ? <Text style={styles.error}>{hoursError}</Text> : null}
            {hoursSaved ? <Text style={styles.saved}>{hoursSaved}</Text> : null}
            <SofButton
              title={savingHours ? 'Salvando…' : 'Salvar horários'}
              variant="dark"
              theme="dashboard"
              disabled={savingHours}
              onPress={async () => {
                setHoursError('');
                setSavingHours(true);
                try {
                  const { account: updated } = await dashboardApi.updateAccount({
                    openingHours: hours,
                  });
                  await setSession(updated);
                  setHoursSaved('Horários salvos!');
                  setTimeout(() => setHoursSaved(''), 2000);
                  setHoursExpanded(false);
                } catch (err) {
                  const message =
                    err instanceof Error
                      ? err.message
                      : 'Não foi possível salvar.';
                  setHoursError(message);
                } finally {
                  setSavingHours(false);
                }
              }}
            />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bot do WhatsApp</Text>
        <Text style={[styles.help, { marginBottom: 12 }]}>
          Servidor:{' '}
          <Text
            style={[styles.badge, integrations.wa ? styles.on : styles.off]}
          >
            {integrations.wa ? 'pronto' : 'desligado'}
          </Text>
          {' · '}
          Dispositivo:{' '}
          <Text style={[styles.badge, waLinked ? styles.on : styles.off]}>
            {waLinked
              ? 'conectado'
              : waStatus === 'connecting'
                ? 'conectando…'
                : 'desconectado'}
          </Text>
        </Text>

        {!integrations.pairingAvailable ? (
          <Text style={styles.help}>
            Para parear pelo painel, configure{' '}
            <Text style={styles.code}>WHATSAPP_PROVIDER=uazapi</Text>,{' '}
            <Text style={styles.code}>WHATSAPP_BASE_URL</Text> e{' '}
            <Text style={styles.code}>WHATSAPP_ADMIN_TOKEN</Text> (ou{' '}
            <Text style={styles.code}>WHATSAPP_TOKEN</Text> de uma instância).
            Enquanto isso, use o simulador na Agenda.
          </Text>
        ) : waLinked ? (
          <>
            {waInstanceId ? (
              <Text style={styles.help}>
                Instância: <Text style={styles.code}>{waInstanceId}</Text>
              </Text>
            ) : null}
            <SofButton
              title={waBusy ? 'Desconectando…' : 'Desconectar WhatsApp'}
              variant="danger"
              theme="dashboard"
              disabled={waBusy}
              onPress={disconnectWa}
            />
          </>
        ) : (
          <>
            <Text style={[styles.help, { marginBottom: 8 }]}>
              Escaneie o QR no WhatsApp (Aparelhos conectados) ou use um código de
              pareamento — igual ao cadastro de instância no Uazapi.
            </Text>

            {waMode === 'idle' || waMode === 'qrcode' ? (
              <View style={styles.waActions}>
                <SofButton
                  title={
                    waBusy && waMode === 'qrcode' ? 'Gerando…' : 'Escanear QR'
                  }
                  variant="dark"
                  theme="dashboard"
                  disabled={waBusy}
                  onPress={connectQr}
                />
                <SofButton
                  title="Usar código"
                  variant="ghost"
                  theme="dashboard"
                  disabled={waBusy}
                  onPress={() => {
                    stopPolling();
                    setWaMode('paircode');
                    setWaQrcode(null);
                    setWaPaircode(null);
                    setWaError('');
                  }}
                />
              </View>
            ) : null}

            {waMode === 'paircode' ? (
              <View style={styles.pairBlock}>
                <SofInput
                  label="Telefone do WhatsApp (DDI + número)"
                  value={waPhone}
                  onChangeText={setWaPhone}
                  theme="dashboard"
                  placeholder="5511999998888"
                  keyboardType="phone-pad"
                />
                <View style={styles.waActions}>
                  <SofButton
                    title={waBusy ? 'Gerando…' : 'Gerar código'}
                    variant="dark"
                    theme="dashboard"
                    disabled={waBusy}
                    onPress={connectPair}
                  />
                  <SofButton
                    title="Voltar ao QR"
                    variant="ghost"
                    theme="dashboard"
                    disabled={waBusy}
                    onPress={() => {
                      stopPolling();
                      setWaMode('idle');
                      setWaPaircode(null);
                      setWaError('');
                    }}
                  />
                </View>
              </View>
            ) : null}

            {waBusy && !waQrcode && !waPaircode ? (
              <ActivityIndicator color={d.ink} style={{ marginTop: 8 }} />
            ) : null}

            {waQrcode ? (
              <View style={styles.qrWrap}>
                <Image
                  source={{ uri: waQrcode }}
                  style={styles.qrImage}
                  accessibilityLabel="QR Code WhatsApp"
                />
                <Text style={styles.help}>
                  Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho
                </Text>
              </View>
            ) : null}

            {waPaircode ? (
              <View style={styles.pairCodeWrap}>
                <Text style={styles.pairCodeLabel}>Código de pareamento</Text>
                <Text style={styles.pairCode}>{waPaircode}</Text>
                <Text style={styles.help}>
                  No WhatsApp, escolha conectar com o número de telefone e digite
                  este código.
                </Text>
              </View>
            ) : null}
          </>
        )}

        {waError ? <Text style={styles.error}>{waError}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lembrete WhatsApp</Text>
        <Text style={[styles.help, { marginBottom: 8 }]}>
          A Sof envia um lembrete automático pela instância conectada, no máximo
          1× por agendamento. O job roda a cada 30 minutos — o aviso pode sair
          até meia hora depois do horário estimado.
        </Text>
        <Text style={styles.label}>Antecedência</Text>
        <View style={styles.chips}>
          {REMINDER_PRESETS.map((preset) => {
            const active = reminderMinutes === preset.minutes;
            return (
              <Pressable
                key={preset.minutes}
                onPress={() => setReminderMinutes(preset.minutes)}
                style={[styles.chip, active && styles.chipActive]}
                disabled={savingReminder}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { marginTop: 8 }]}>Fuso horário</Text>
        <Pressable
          onPress={() => setTimezoneOpen((prev) => !prev)}
          style={styles.tzButton}
          disabled={savingReminder}
          accessibilityRole="button"
          accessibilityState={{ expanded: timezoneOpen }}
        >
          <Text style={styles.tzButtonText}>
            {TIMEZONE_OPTIONS.find((opt) => opt.value === timezone)?.label ||
              timezone}
          </Text>
          <Text style={styles.tzChevron}>{timezoneOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {timezoneOpen ? (
          <View style={styles.tzList}>
            {TIMEZONE_OPTIONS.map((opt) => {
              const active = timezone === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setTimezone(opt.value);
                    setTimezoneOpen(false);
                  }}
                  style={[styles.tzOption, active && styles.tzOptionActive]}
                  disabled={savingReminder}
                >
                  <Text
                    style={[
                      styles.tzOptionText,
                      active && styles.tzOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active ? <Text style={styles.tzCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {reminderError ? <Text style={styles.error}>{reminderError}</Text> : null}
        {reminderSaved ? <Text style={styles.saved}>{reminderSaved}</Text> : null}
        <SofButton
          title={savingReminder ? 'Salvando…' : 'Salvar lembrete'}
          variant="dark"
          theme="dashboard"
          disabled={savingReminder}
          onPress={async () => {
            setReminderError('');
            setSavingReminder(true);
            try {
              const { account: updated } = await dashboardApi.updateAccount({
                whatsappReminderMinutes: reminderMinutes,
                timezone,
              });
              await setSession(updated);
              setReminderSaved('Configuração de lembrete salva!');
              setTimeout(() => setReminderSaved(''), 2000);
            } catch (err) {
              setReminderError(
                err instanceof Error
                  ? err.message
                  : 'Não foi possível salvar.',
              );
            } finally {
              setSavingReminder(false);
            }
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sair da conta</Text>
        <SofButton
          title="Sair"
          variant="danger"
          theme="dashboard"
          onPress={async () => {
            await logout();
            router.replace('/');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24, maxWidth: 720 },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    marginBottom: 4,
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  expandBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: d.line,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expandBtnText: { fontWeight: '600', fontSize: 13, color: d.ink },
  hoursSummary: {
    color: d.ink,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  meta: { minWidth: 160, flexGrow: 1, flexBasis: 160 },
  metaLabel: { color: d.muted, fontSize: 13, marginBottom: 4 },
  metaValue: { fontWeight: '700', fontSize: 15, color: d.ink },
  help: { color: d.muted, fontSize: 14, lineHeight: 22 },
  label: { fontWeight: '600', color: d.ink, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  chipText: { color: d.ink, fontSize: 13 },
  chipTextActive: { fontWeight: '700' },
  tzButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  tzButtonText: { color: d.ink, fontSize: 14, fontWeight: '600' },
  tzChevron: { color: d.muted, fontSize: 11 },
  tzList: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  tzOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  tzOptionActive: { backgroundColor: '#eff6ff' },
  tzOptionText: { color: d.ink, fontSize: 14 },
  tzOptionTextActive: { fontWeight: '700' },
  tzCheck: { color: d.accent, fontWeight: '700' },
  badge: { fontWeight: '700' },
  on: { color: '#0d9c53' },
  off: { color: '#94a3b8' },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: d.ink,
    backgroundColor: '#f1f5f9',
  },
  saved: { color: '#0d9c53', fontWeight: '600' },
  error: { color: '#dc2626', fontWeight: '600' },
  dayRow: {
    borderTopWidth: 1,
    borderTopColor: d.line,
    paddingTop: 12,
    gap: 8,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayLabel: { fontWeight: '700', color: d.ink, fontSize: 15 },
  toggle: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleOn: { borderColor: '#0d9c53', backgroundColor: '#ecfdf5' },
  toggleOff: { borderColor: d.line, backgroundColor: '#f8fafc' },
  toggleText: { fontWeight: '600', fontSize: 13, color: d.ink },
  timeRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  timeField: { flexGrow: 1, flexBasis: 120, minWidth: 120 },
  waActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pairBlock: { gap: 12 },
  qrWrap: { alignItems: 'center', gap: 12, marginTop: 8 },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: d.line,
  },
  pairCodeWrap: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: d.line,
  },
  pairCodeLabel: { color: d.muted, fontSize: 13, fontWeight: '600' },
  pairCode: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    color: d.ink,
    fontFamily: 'monospace',
  },
});
