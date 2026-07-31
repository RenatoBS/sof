import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { dashboardApi } from '@/src/api/endpoints';
import type { DaySchedule, OpeningHours } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { useEntitlements } from '@/src/entitlements/useEntitlements';
import { BusinessLogo } from '@/src/components/BusinessLogo';
import { SofButton, SofCard, SofIconAction, SofInput } from '@/src/components/ui';
import { ChoosePlanModal } from '@/src/features/account/ChoosePlanModal';
import {
  EstablishmentModal,
} from '@/src/features/account/EstablishmentModal';
import {
  normalizeOpeningHours,
  OpeningHoursModal,
} from '@/src/features/account/OpeningHoursModal';
import {
  isValidPhoneDigits,
  maskBrPhone,
  normalizePhoneDigits,
} from '@/src/lib/validation';
import { d } from '@/src/theme/dashboard';

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

type PairingMode = 'idle' | 'qrcode' | 'paircode';

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
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const { account, setSession } = useAuth();
  const [hours, setHours] = useState<OpeningHours>(() =>
    normalizeOpeningHours(null),
  );
  const [establishmentOpen, setEstablishmentOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [integrations, setIntegrations] = useState({
    wa: false,
    pairingAvailable: false,
  });

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
  const waModeRef = useRef<PairingMode>('idle');
  const qrFetchLockRef = useRef(false);
  const lastQrFetchAtRef = useRef(0);

  const [botPauseMode, setBotPauseMode] = useState<BotPauseMode>('off');
  const [botPauseSaved, setBotPauseSaved] = useState('');
  const [botPauseError, setBotPauseError] = useState('');
  const [savingBotPause, setSavingBotPause] = useState(false);

  useEffect(() => {
    waModeRef.current = waMode;
  }, [waMode]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPollingRef = useRef<() => void>(() => undefined);

  const fetchQr = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (qrFetchLockRef.current) return;
      if (waModeRef.current === 'paircode') return;
      qrFetchLockRef.current = true;
      setWaError('');
      setWaMode('qrcode');
      setWaPaircode(null);
      if (!opts?.silent) setWaBusy(true);
      try {
        const data = await dashboardApi.connectWhatsapp();
        if (waModeRef.current === 'paircode') return;
        lastQrFetchAtRef.current = Date.now();
        setWaStatus(data.status);
        setWaInstanceId(data.instanceId || '');
        setWaQrcode(data.qrcode || null);
        startPollingRef.current();
      } catch (err) {
        if (waModeRef.current === 'paircode') return;
        setWaError(
          err instanceof Error ? err.message : 'Não foi possível gerar o QR.',
        );
        // Mantém o poll para tentar renovar sozinho.
        startPollingRef.current();
      } finally {
        qrFetchLockRef.current = false;
        setWaBusy(false);
      }
    },
    [],
  );

  const refreshWaStatus = useCallback(async () => {
    try {
      const data = await dashboardApi.whatsappStatus();
      setWaStatus(data.status);
      setWaLinked(data.linked);
      setWaInstanceId(data.instanceId || '');
      if (data.linked) {
        stopPolling();
        setWaMode('idle');
        setWaQrcode(null);
        setWaPaircode(null);
        return data;
      }

      const mode = waModeRef.current;
      if (mode === 'qrcode') {
        if (data.qrcode) {
          setWaQrcode(data.qrcode);
        }
        const age = Date.now() - lastQrFetchAtRef.current;
        const needsRefresh = !data.qrcode || age >= 45_000;
        if (needsRefresh && age >= 5_000) {
          void fetchQr({ silent: true });
        }
      } else if (mode === 'paircode') {
        if (data.paircode) setWaPaircode(data.paircode);
      }
      return data;
    } catch {
      return null;
    }
  }, [fetchQr, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => {
      void refreshWaStatus();
    }, 2500);
  }, [refreshWaStatus, stopPolling]);

  startPollingRef.current = startPolling;

  useEffect(() => {
    if (account) {
      setHours(normalizeOpeningHours(account.openingHours));
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

  const wantsAutoQr =
    integrations.pairingAvailable && !waLinked && waMode !== 'paircode';

  /** QR já aberto quando o dispositivo ainda não está pareado. */
  useEffect(() => {
    if (!wantsAutoQr) return;
    void fetchQr();
  }, [wantsAutoQr, fetchQr]);

  if (!account) return null;

  const since = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString('pt-BR')
    : '—';

  const connectPair = async () => {
    setWaError('');
    const digits = normalizePhoneDigits(waPhone);
    if (!isValidPhoneDigits(digits)) {
      setWaError('Informe o telefone com DDI (ex: +55 11 99999-8888).');
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
      lastQrFetchAtRef.current = 0;
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

  const phoneDisplay = account.phone
    ? maskBrPhone(account.phone)
    : 'Telefone não cadastrado';
  const addressDisplay = account.address?.trim() || 'Endereço não cadastrado';

  const waDeviceLabel = waLinked
    ? 'Conectado'
    : waStatus === 'connecting'
      ? 'Conectando…'
      : 'Desconectado';

  const botPausedNow =
    Boolean(account.botPausedPermanent) ||
    Boolean(formatBotPauseUntil(account.botPausedUntil));

  const establishmentSection = (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Estabelecimento</Text>
      <SofCard>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Dados do negócio</Text>
          <SofIconAction
            action="edit"
            forceCompact
            onPress={() => setEstablishmentOpen(true)}
          />
        </View>
        <View style={styles.profileBody}>
          <BusinessLogo
            uri={account.logoBase64}
            initials={initials}
            size={64}
          />
          <View style={styles.profileCopy}>
            <Text style={styles.h2} numberOfLines={2}>
              {account.businessName || 'Sua conta'}
            </Text>
            {account.ownerName ? (
              <Text style={styles.sub} numberOfLines={1}>
                Responsável: {account.ownerName}
              </Text>
            ) : null}
            <Text style={styles.metaLine} numberOfLines={1}>
              {phoneDisplay}
            </Text>
            <Text style={styles.metaLine} numberOfLines={3}>
              {addressDisplay}
            </Text>
          </View>
        </View>
      </SofCard>
    </View>
  );

  const hoursSection = (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Horário</Text>
      <SofCard>
        <View style={styles.cardHead}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle}>Horário de funcionamento</Text>
            <Text style={styles.cardHint}>
              Quando clientes podem agendar pelo WhatsApp e pelo painel
            </Text>
          </View>
          <SofIconAction
            action="edit"
            forceCompact
            onPress={() => setHoursOpen(true)}
          />
        </View>
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
      </SofCard>
    </View>
  );

  const planSection = (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Assinatura</Text>
      <SofCard>
        <View style={styles.planBanner}>
          <View style={styles.planBannerText}>
            <Text style={styles.planBannerName}>{account.plan}</Text>
            <Text style={styles.planBannerPrice}>
              {account.planPrice != null
                ? `R$ ${account.planPrice}/mês`
                : 'Plano ativo'}
            </Text>
            <Text style={styles.planBannerMeta}>
              {[
                `Desde ${since}`,
                account.billingSource === 'promo' && account.promoExpiresAt
                  ? `Promo até ${new Date(account.promoExpiresAt).toLocaleDateString('pt-BR')}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <SofButton
            title="Alterar plano"
            variant="light"
            theme="dashboard"
            onPress={() => setPlanOpen(true)}
          />
        </View>
      </SofCard>
    </View>
  );

  const whatsappSection = (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>WhatsApp</Text>
      <SofCard>
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
              <Text style={styles.code}>WHATSAPP_TOKEN</Text> de uma
              instância).
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
            {waMode === 'paircode' ? (
              <View style={styles.pairBlock}>
                <Text style={styles.help}>
                  Informe o telefone do WhatsApp para gerar um código de
                  pareamento.
                </Text>
                <SofInput
                  label="Telefone do WhatsApp (DDI + número)"
                  value={waPhone}
                  onChangeText={setWaPhone}
                  theme="dashboard"
                  placeholder="+55 (11) 99999-8888"
                  mask="phoneDdi"
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
                      setWaPaircode(null);
                      setWaError('');
                      lastQrFetchAtRef.current = 0;
                      setWaMode('qrcode');
                    }}
                  />
                </View>
                {waPaircode ? (
                  <View style={styles.pairCodeWrap}>
                    <Text style={styles.pairCodeLabel}>
                      Código de pareamento
                    </Text>
                    <Text style={styles.pairCode}>{waPaircode}</Text>
                    <Text style={styles.helpCenter}>
                      No WhatsApp, escolha conectar com o número de telefone e
                      digite este código.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <>
                <Text style={styles.help}>
                  Escaneie o QR no WhatsApp (Aparelhos conectados). O código
                  renova sozinho enquanto a conexão não for concluída.
                </Text>
                {waBusy && !waQrcode ? (
                  <ActivityIndicator
                    color={d.ink}
                    style={{ marginTop: 8 }}
                  />
                ) : null}
                {waQrcode ? (
                  <View style={styles.qrWrap}>
                    <Image
                      source={{ uri: waQrcode }}
                      style={styles.qrImage}
                      accessibilityLabel="QR Code WhatsApp"
                    />
                    <Text style={styles.helpCenter}>
                      Abra o WhatsApp → Aparelhos conectados → Conectar um
                      aparelho
                    </Text>
                  </View>
                ) : null}
                <View style={styles.waActions}>
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
              </>
            )}
          </>
        )}

        {!waLinked ? (
          <View style={styles.simBlock}>
            <Text style={styles.help}>
              Sem número pareado, teste o bot no simulador (telefone +
              mensagem).
            </Text>
            <SofButton
              title="Simulador WhatsApp"
              variant="light"
              theme="dashboard"
              onPress={() => router.push('/(dashboard)/simulator')}
            />
          </View>
        ) : null}

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
                  const { account: updated } =
                    await dashboardApi.updateAccount(
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
      </SofCard>
    </View>
  );

  const remindersSection =
    has('reminders') && waLinked ? (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Lembretes</Text>
        <SofCard>
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
        </SofCard>
      </View>
    ) : null;

  const helpSection = (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Ajuda</Text>
      <SofCard>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>Suporte Sof</Text>
          <Text style={styles.cardHint}>
            Abra um ticket para falar com a equipe Sof sobre conta, cobrança
            ou WhatsApp.
          </Text>
        </View>
        <SofButton
          title="Abrir suporte"
          variant="light"
          theme="dashboard"
          onPress={() => router.push('/(dashboard)/support')}
        />
      </SofCard>
    </View>
  );

  return (
    <View style={[styles.page, wide && styles.pageWide]}>
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {establishmentSection}
            {planSection}
            {remindersSection}
            {helpSection}
          </View>
          <View style={styles.column}>
            {hoursSection}
            {whatsappSection}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {establishmentSection}
          {hoursSection}
          {planSection}
          {whatsappSection}
          {remindersSection}
          {helpSection}
        </View>
      )}

      <EstablishmentModal
        visible={establishmentOpen}
        onClose={() => setEstablishmentOpen(false)}
        account={account}
      />
      <OpeningHoursModal
        visible={hoursOpen}
        onClose={() => setHoursOpen(false)}
        initialHours={hours}
        onSaved={(saved) => {
          setHours(saved);
          void setSession({ ...account, openingHours: saved });
        }}
      />
      <ChoosePlanModal
        visible={planOpen}
        onClose={() => setPlanOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 18, width: '100%', maxWidth: 760 },
  pageWide: {
    alignSelf: 'center',
    maxWidth: 1040,
  },
  stack: {
    gap: 18,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 24,
  },
  column: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: '48%',
    gap: 18,
  },
  section: {
    width: '100%',
    gap: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  profileCopy: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.3,
  },
  sub: {
    color: d.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: d.fonts.body,
  },
  metaLine: {
    color: d.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: d.fonts.body,
  },
  sectionLabel: {
    color: d.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.2,
  },
  cardTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
  cardHint: {
    color: d.muted,
    fontSize: 13,
    fontFamily: d.fonts.body,
    lineHeight: 19,
  },
  planBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planBannerText: { gap: 2, flex: 1, minWidth: 140 },
  planBannerName: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
  },
  planBannerPrice: {
    fontSize: 14,
    color: d.muted,
    fontWeight: '500',
    fontFamily: d.fonts.body,
  },
  planBannerMeta: {
    fontSize: 13,
    color: d.muted,
    fontFamily: d.fonts.body,
    marginTop: 4,
  },
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
  dayPillClosed: { backgroundColor: d.fill },
  dayPillText: { fontSize: 12, fontWeight: '700' },
  dayPillTextOpen: { color: d.waGreenText },
  dayPillTextClosed: { color: d.muted },
  hoursSummary: {
    color: d.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: d.fonts.body,
  },
  help: { color: d.muted, fontSize: 14, lineHeight: 21 },
  helpCenter: {
    color: d.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  label: { fontWeight: '600', color: d.ink, fontSize: 14 },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
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
  statusDotOn: { backgroundColor: d.waGreenText },
  statusDotOff: { backgroundColor: '#94a3b8' },
  statusDotLg: { width: 10, height: 10, borderRadius: 5 },
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
    gap: 12,
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
  tzOptionActive: { backgroundColor: d.accentSoft },
  tzOptionText: { color: d.ink, fontSize: 14, flex: 1 },
  tzOptionTextActive: { fontWeight: '700' },
  tzCheck: { color: d.accent, fontWeight: '700' },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: d.ink,
    backgroundColor: '#f1f5f9',
  },
  simBlock: {
    marginTop: 4,
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: d.line,
  },
  saved: { color: d.waGreenText, fontWeight: '600' },
  error: { color: d.danger, fontWeight: '600' },
  waActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
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
});
