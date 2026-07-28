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
import { useEntitlements } from '@/src/entitlements/useEntitlements';
import { SofButton, SofInput } from '@/src/components/ui';
import {
  isValidPhoneDigits,
  isValidTimeHm,
  maskBrPhone,
  normalizePhoneDigits,
} from '@/src/lib/validation';
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

type BotPauseMode = 'off' | 'permanent' | '1h' | '8h' | '24h' | '3d' | '7d';

const BOT_PAUSE_PRESETS: {
  id: BotPauseMode;
  label: string;
  hours?: number;
}[] = [
  { id: 'off', label: 'Bot ativo' },
  { id: '1h', label: '1 hora', hours: 1 },
  { id: '8h', label: '8 horas', hours: 8 },
  { id: '24h', label: '24 horas', hours: 24 },
  { id: '3d', label: '3 dias', hours: 24 * 3 },
  { id: '7d', label: '7 dias', hours: 24 * 7 },
  { id: 'permanent', label: 'Permanente' },
];

function botPauseModeFromAccount(account: {
  botPausedPermanent?: boolean;
  botPausedUntil?: string | null;
}): BotPauseMode {
  if (account.botPausedPermanent) return 'permanent';
  if (!account.botPausedUntil) return 'off';
  const until = new Date(account.botPausedUntil);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return 'off';
  }
  return '24h';
}

function botPausePayload(mode: BotPauseMode): {
  botPausedPermanent: boolean;
  botPausedUntil: string | null;
} {
  if (mode === 'off') {
    return { botPausedPermanent: false, botPausedUntil: null };
  }
  if (mode === 'permanent') {
    return { botPausedPermanent: true, botPausedUntil: null };
  }
  const preset = BOT_PAUSE_PRESETS.find((p) => p.id === mode);
  const hours = preset?.hours || 24;
  return {
    botPausedPermanent: false,
    botPausedUntil: new Date(
      Date.now() + hours * 60 * 60 * 1000,
    ).toISOString(),
  };
}

function formatBotPauseUntil(iso?: string | null) {
  if (!iso) return '';
  const until = new Date(iso);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return '';
  }
  return until.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const { has } = useEntitlements();

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
  const [phone, setPhone] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactSaved, setContactSaved] = useState('');
  const [savingContact, setSavingContact] = useState(false);

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

  const [botPauseMode, setBotPauseMode] = useState<BotPauseMode>('off');
  const [botPauseSaved, setBotPauseSaved] = useState('');
  const [botPauseError, setBotPauseError] = useState('');
  const [savingBotPause, setSavingBotPause] = useState(false);

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
      setPhone(maskBrPhone(account.phone || ''));
      const lead = Number(account.whatsappReminderMinutes);
      setReminderMinutes(
        Number.isFinite(lead) &&
          REMINDER_PRESETS.some((p) => p.minutes === lead)
          ? lead
          : 120,
      );
      setTimezone(account.timezone || 'America/Sao_Paulo');
      setBotPauseMode(botPauseModeFromAccount(account));
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
    const digits = normalizePhoneDigits(waPhone);
    if (!isValidPhoneDigits(digits)) {
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

  const initials = (account.businessName || 'S')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const waDeviceLabel = waLinked
    ? 'Conectado'
    : waStatus === 'connecting'
      ? 'Conectando…'
      : 'Desconectado';

  const botPausedNow =
    Boolean(account.botPausedPermanent) ||
    Boolean(formatBotPauseUntil(account.botPausedUntil));

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || 'S'}</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.h2}>{account.businessName || 'Sua conta'}</Text>
          <Text style={styles.sub}>
            {[account.ownerName, account.email].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.heroBadges}>
            <View style={styles.planPill}>
              <Text style={styles.planPillText}>{account.plan}</Text>
            </View>
            {account.billingSource === 'promo' ? (
              <View style={styles.promoPill}>
                <Text style={styles.promoPillText}>Promo</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.statusPill,
                waLinked ? styles.statusPillOn : styles.statusPillOff,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  waLinked ? styles.statusDotOn : styles.statusDotOff,
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  waLinked ? styles.statusPillTextOn : styles.statusPillTextOff,
                ]}
              >
                WhatsApp {waDeviceLabel.toLowerCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Assinatura</Text>
      <View style={styles.card}>
        <View style={styles.planBanner}>
          <View style={styles.planBannerText}>
            <Text style={styles.planBannerName}>{account.plan}</Text>
            <Text style={styles.planBannerPrice}>
              {account.planPrice != null
                ? `R$ ${account.planPrice}/mês`
                : 'Plano ativo'}
            </Text>
          </View>
          <SofButton
            title="Alterar plano"
            variant="light"
            theme="dashboard"
            onPress={() => router.push('/(dashboard)/choose-plan')}
          />
        </View>
        <View style={styles.metaGrid}>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>E-mail</Text>
            <Text style={styles.metaValue}>{account.email}</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Assinante desde</Text>
            <Text style={styles.metaValue}>{since}</Text>
          </View>
          {account.billingSource === 'promo' && account.promoExpiresAt ? (
            <View style={styles.meta}>
              <Text style={styles.metaLabel}>Promo até</Text>
              <Text style={styles.metaValue}>
                {new Date(account.promoExpiresAt).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Estabelecimento</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contato, endereço e horário</Text>
        <Text style={styles.help}>
          Dados do estabelecimento: telefone do responsável, endereço (o bot
          pode informar aos clientes) e expediente de agendamento.
        </Text>

        <SofInput
          label="Telefone (com DDD)"
          value={phone}
          onChangeText={(t) => {
            setPhone(maskBrPhone(t));
            setContactError('');
          }}
          theme="dashboard"
          placeholder="(11) 99999-8888"
          keyboardType="phone-pad"
          error={contactError || undefined}
        />
        <SofInput
          label="Endereço do estabelecimento"
          value={address}
          onChangeText={(t) => {
            setAddress(t);
            setContactError('');
          }}
          theme="dashboard"
          placeholder="Rua Exemplo, 123 — Bairro, Cidade"
          autoCapitalize="words"
        />
        {contactSaved ? <Text style={styles.saved}>{contactSaved}</Text> : null}
        <View style={styles.inlineActions}>
          <SofButton
            title={savingContact ? 'Salvando…' : 'Salvar contato'}
            variant="dark"
            theme="dashboard"
            disabled={savingContact}
            onPress={async () => {
              setContactError('');
              const digits = normalizePhoneDigits(phone);
              if (!isValidPhoneDigits(digits)) {
                setContactError(
                  'Telefone inválido. Use DDD + número (10 a 15 dígitos).',
                );
                return;
              }
              setSavingContact(true);
              try {
                const { account: updated } = await dashboardApi.updateAccount({
                  phone: digits,
                  address: address.trim(),
                });
                await setSession(updated);
                setPhone(maskBrPhone(updated.phone || digits));
                setAddress(updated.address || address.trim());
                setContactSaved('Dados salvos!');
                setTimeout(() => setContactSaved(''), 2000);
              } catch (err) {
                setContactError(
                  err instanceof Error
                    ? err.message
                    : 'Não foi possível salvar.',
                );
              } finally {
                setSavingContact(false);
              }
            }}
          />
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.hoursHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.subCardTitle}>Horário de funcionamento</Text>
            {!hoursExpanded ? (
              <Text style={styles.cardHint}>Quando clientes podem agendar</Text>
            ) : null}
          </View>
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
          <View style={styles.hoursPreview}>
            <View style={styles.dayPills}>
              {hours.map((day, index) => (
                <View
                  key={DAY_SHORT[index]}
                  style={[
                    styles.dayPill,
                    day.open ? styles.dayPillOpen : styles.dayPillClosed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      day.open
                        ? styles.dayPillTextOpen
                        : styles.dayPillTextClosed,
                    ]}
                  >
                    {DAY_SHORT[index]}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.hoursSummary}>{formatHoursSummary(hours)}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.help}>
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
                for (let i = 0; i < hours.length; i += 1) {
                  const day = hours[i];
                  if (!day.open) continue;
                  if (!isValidTimeHm(day.start) || !isValidTimeHm(day.end)) {
                    setHoursError(
                      `${DAY_LABELS[i]}: use horários no formato HH:mm (ex.: 09:00).`,
                    );
                    return;
                  }
                  if (day.start >= day.end) {
                    setHoursError(
                      `${DAY_LABELS[i]}: o horário de abertura deve ser antes do fechamento.`,
                    );
                    return;
                  }
                }
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

      <Text style={styles.sectionLabel}>WhatsApp</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bot e conexão</Text>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusCard,
              integrations.wa ? styles.statusCardOn : styles.statusCardMuted,
            ]}
          >
            <View
              style={[
                styles.statusDotLg,
                integrations.wa ? styles.statusDotOn : styles.statusDotOff,
              ]}
            />
            <View style={styles.statusCardText}>
              <Text style={styles.statusCardLabel}>Servidor</Text>
              <Text style={styles.statusCardValue}>
                {integrations.wa ? 'Pronto' : 'Desligado'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusCard,
              waLinked ? styles.statusCardOn : styles.statusCardMuted,
            ]}
          >
            <View
              style={[
                styles.statusDotLg,
                waLinked ? styles.statusDotOn : styles.statusDotOff,
              ]}
            />
            <View style={styles.statusCardText}>
              <Text style={styles.statusCardLabel}>Dispositivo</Text>
              <Text style={styles.statusCardValue}>{waDeviceLabel}</Text>
            </View>
          </View>
        </View>

        {!integrations.pairingAvailable ? (
          <View style={styles.infoBox}>
            <Text style={styles.help}>
              Para parear pelo painel, configure{' '}
              <Text style={styles.code}>WHATSAPP_PROVIDER=uazapi</Text>,{' '}
              <Text style={styles.code}>WHATSAPP_BASE_URL</Text> e{' '}
              <Text style={styles.code}>WHATSAPP_ADMIN_TOKEN</Text> (ou{' '}
              <Text style={styles.code}>WHATSAPP_TOKEN</Text> de uma instância).
              Enquanto isso, use o simulador na Agenda.
            </Text>
          </View>
        ) : waLinked ? (
          <View style={styles.connectedBox}>
            <Text style={styles.connectedTitle}>WhatsApp pareado</Text>
            {waInstanceId ? (
              <Text style={styles.help}>
                Instância: <Text style={styles.code}>{waInstanceId}</Text>
              </Text>
            ) : (
              <Text style={styles.help}>
                O bot está pronto para atender seus clientes.
              </Text>
            )}
            <SofButton
              title={waBusy ? 'Desconectando…' : 'Desconectar WhatsApp'}
              variant="danger"
              theme="dashboard"
              disabled={waBusy}
              onPress={disconnectWa}
            />
          </View>
        ) : (
          <>
            <Text style={styles.help}>
              Escaneie o QR no WhatsApp (Aparelhos conectados) ou use um código
              de pareamento — igual ao cadastro de instância no Uazapi.
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
                  variant="light"
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
                    variant="light"
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
                <Text style={styles.helpCenter}>
                  Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho
                </Text>
              </View>
            ) : null}

            {waPaircode ? (
              <View style={styles.pairCodeWrap}>
                <Text style={styles.pairCodeLabel}>Código de pareamento</Text>
                <Text style={styles.pairCode}>{waPaircode}</Text>
                <Text style={styles.helpCenter}>
                  No WhatsApp, escolha conectar com o número de telefone e digite
                  este código.
                </Text>
              </View>
            ) : null}
          </>
        )}

        {waError ? <Text style={styles.error}>{waError}</Text> : null}

        {has('botPause') && waLinked ? (
          <View style={styles.pauseBlock}>
            <View style={styles.pauseHead}>
              <Text style={styles.label}>Pausa do bot</Text>
              <View
                style={[
                  styles.miniBadge,
                  botPausedNow ? styles.miniBadgeWarn : styles.miniBadgeOk,
                ]}
              >
                <Text
                  style={[
                    styles.miniBadgeText,
                    botPausedNow
                      ? styles.miniBadgeTextWarn
                      : styles.miniBadgeTextOk,
                  ]}
                >
                  {account?.botPausedPermanent
                    ? 'Desligado'
                    : formatBotPauseUntil(account?.botPausedUntil)
                      ? 'Pausado'
                      : 'Ativo'}
                </Text>
              </View>
            </View>
            <Text style={styles.help}>
              Silencia o bot para todos os clientes (conta inteira). Útil em
              folga, feriado ou quando você atende manualmente no WhatsApp.
            </Text>
            <View style={styles.chips}>
              {BOT_PAUSE_PRESETS.map((p) => {
                const active = botPauseMode === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setBotPauseMode(p.id)}
                    style={[styles.chip, active && styles.chipActive]}
                    disabled={savingBotPause}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {account?.botPausedPermanent ? (
              <Text style={styles.pauseStatus}>
                Bot desligado (permanente).
              </Text>
            ) : formatBotPauseUntil(account?.botPausedUntil) ? (
              <Text style={styles.pauseStatus}>
                Pausado até {formatBotPauseUntil(account?.botPausedUntil)}.
              </Text>
            ) : (
              <Text style={styles.pauseStatus}>
                Bot ativo para novos clientes.
              </Text>
            )}
            {botPauseError ? (
              <Text style={styles.error}>{botPauseError}</Text>
            ) : null}
            {botPauseSaved ? (
              <Text style={styles.saved}>{botPauseSaved}</Text>
            ) : null}
            <SofButton
              title={savingBotPause ? 'Salvando…' : 'Salvar pausa do bot'}
              variant="dark"
              theme="dashboard"
              disabled={savingBotPause}
              onPress={async () => {
                setBotPauseError('');
                setSavingBotPause(true);
                try {
                  const { account: updated } = await dashboardApi.updateAccount(
                    botPausePayload(botPauseMode),
                  );
                  await setSession(updated);
                  setBotPauseMode(botPauseModeFromAccount(updated));
                  setBotPauseSaved('Pausa do bot atualizada!');
                  setTimeout(() => setBotPauseSaved(''), 2000);
                } catch (err) {
                  setBotPauseError(
                    err instanceof Error
                      ? err.message
                      : 'Não foi possível salvar.',
                  );
                } finally {
                  setSavingBotPause(false);
                }
              }}
            />
          </View>
        ) : null}
      </View>

      {has('reminders') && waLinked ? (
        <>
          <Text style={styles.sectionLabel}>Lembretes</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lembrete WhatsApp</Text>
            <Text style={styles.help}>
              A Sof envia um lembrete automático pela instância conectada, no
              máximo 1× por agendamento. O job roda a cada 30 minutos — o aviso
              pode sair até meia hora depois do horário estimado.
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
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { marginTop: 4 }]}>Fuso horário</Text>
            <Pressable
              onPress={() => setTimezoneOpen((prev) => !prev)}
              style={styles.tzButton}
              disabled={savingReminder}
              accessibilityRole="button"
              accessibilityState={{ expanded: timezoneOpen }}
            >
              <Text style={styles.tzButtonText}>
                {TIMEZONE_OPTIONS.find((opt) => opt.value === timezone)
                  ?.label || timezone}
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
            {reminderError ? (
              <Text style={styles.error}>{reminderError}</Text>
            ) : null}
            {reminderSaved ? (
              <Text style={styles.saved}>{reminderSaved}</Text>
            ) : null}
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
        </>
      ) : null}

      <View style={styles.dangerZone}>
        <View style={styles.dangerText}>
          <Text style={styles.dangerTitle}>Sessão</Text>
          <Text style={styles.help}>
            Encerra o acesso neste dispositivo. Você pode entrar de novo a
            qualquer momento.
          </Text>
        </View>
        <SofButton
          title="Sair da conta"
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
  page: { gap: 16, maxWidth: 720 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: d.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroText: { flex: 1, gap: 4, minWidth: 0 },
  h2: { fontSize: 28, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, lineHeight: 20 },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  planPill: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planPillText: { color: d.accent, fontSize: 12, fontWeight: '700' },
  promoPill: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  promoPillText: { color: '#b45309', fontSize: 12, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillOn: { backgroundColor: '#ecfdf5' },
  statusPillOff: { backgroundColor: '#f1f5f9' },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  statusPillTextOn: { color: d.waGreenText },
  statusPillTextOff: { color: d.muted },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotOn: { backgroundColor: d.waGreenText },
  statusDotOff: { backgroundColor: '#94a3b8' },
  statusDotLg: { width: 10, height: 10, borderRadius: 5 },
  sectionLabel: {
    color: d.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: d.ink },
  subCardTitle: { fontSize: 15, fontWeight: '700', color: d.ink },
  cardTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
  cardHint: { color: d.muted, fontSize: 13 },
  sectionDivider: {
    height: 1,
    backgroundColor: d.line,
    marginVertical: 4,
  },
  planBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: d.radiusSm,
    borderWidth: 1,
    borderColor: d.line,
    padding: 16,
  },
  planBannerText: { gap: 2, flex: 1, minWidth: 140 },
  planBannerName: { fontSize: 18, fontWeight: '700', color: d.ink },
  planBannerPrice: { fontSize: 14, color: d.muted, fontWeight: '500' },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  expandBtn: {
    borderRadius: d.radiusSm,
    borderWidth: 1,
    borderColor: d.line,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expandBtnText: { fontWeight: '600', fontSize: 13, color: d.ink },
  hoursPreview: { gap: 12 },
  dayPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayPill: {
    minWidth: 40,
    alignItems: 'center',
    borderRadius: d.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dayPillOpen: { backgroundColor: '#ecfdf5' },
  dayPillClosed: { backgroundColor: '#f1f5f9' },
  dayPillText: { fontSize: 12, fontWeight: '700' },
  dayPillTextOpen: { color: d.waGreenText },
  dayPillTextClosed: { color: '#94a3b8' },
  hoursSummary: {
    color: d.ink,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  meta: { minWidth: 140, flexGrow: 1, flexBasis: 140 },
  metaLabel: { color: d.muted, fontSize: 12, marginBottom: 4, fontWeight: '600' },
  metaValue: { fontWeight: '600', fontSize: 14, color: d.ink },
  help: { color: d.muted, fontSize: 14, lineHeight: 21 },
  helpCenter: {
    color: d.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  label: { fontWeight: '600', color: d.ink, fontSize: 14 },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  chipText: { color: d.ink, fontSize: 13 },
  chipTextActive: { fontWeight: '700', color: d.accent },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 140,
    borderRadius: d.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusCardOn: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusCardMuted: {
    backgroundColor: '#f8fafc',
    borderColor: d.line,
  },
  statusCardText: { gap: 2 },
  statusCardLabel: { color: d.muted, fontSize: 11, fontWeight: '600' },
  statusCardValue: { color: d.ink, fontSize: 14, fontWeight: '700' },
  infoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: d.radiusSm,
    borderWidth: 1,
    borderColor: d.line,
    padding: 14,
  },
  connectedBox: {
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderRadius: d.radiusSm,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 16,
  },
  connectedTitle: { fontSize: 15, fontWeight: '700', color: d.waGreenText },
  pauseBlock: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: d.line,
    gap: 10,
  },
  pauseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  miniBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  miniBadgeOk: { backgroundColor: '#ecfdf5' },
  miniBadgeWarn: { backgroundColor: '#fef3c7' },
  miniBadgeText: { fontSize: 12, fontWeight: '700' },
  miniBadgeTextOk: { color: d.waGreenText },
  miniBadgeTextWarn: { color: '#b45309' },
  pauseStatus: { color: d.ink, fontSize: 13, fontWeight: '600' },
  tzButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  tzButtonText: { color: d.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  tzChevron: { color: d.muted, fontSize: 11 },
  tzList: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
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
  tzOptionText: { color: d.ink, fontSize: 14, flex: 1 },
  tzOptionTextActive: { fontWeight: '700' },
  tzCheck: { color: d.accent, fontWeight: '700' },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: d.ink,
    backgroundColor: '#f1f5f9',
  },
  saved: { color: d.waGreenText, fontWeight: '600' },
  error: { color: d.danger, fontWeight: '600' },
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
    borderRadius: d.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleOn: { borderColor: '#0d9c53', backgroundColor: '#ecfdf5' },
  toggleOff: { borderColor: d.line, backgroundColor: '#f8fafc' },
  toggleText: { fontWeight: '600', fontSize: 13, color: d.ink },
  timeRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  timeField: { flexGrow: 1, flexBasis: 120, minWidth: 120 },
  waActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pairBlock: { gap: 12 },
  qrWrap: { alignItems: 'center', gap: 12, marginTop: 4 },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: d.radiusSm,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: d.line,
  },
  pairCodeWrap: {
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    padding: 20,
    borderRadius: d.radiusSm,
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
  dangerZone: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.dangerSoft,
    backgroundColor: '#fffafa',
    padding: 20,
  },
  dangerText: { flex: 1, gap: 4, minWidth: 180 },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: d.ink },
});
