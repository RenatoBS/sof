import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const DEFAULT_HOURS: OpeningHours = [
  { open: false, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
];

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

export default function AccountScreen() {
  const { account, logout, setSession } = useAuth();
  const [phoneId, setPhoneId] = useState('');
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [integrations, setIntegrations] = useState({ stripe: false, wa: false });
  const [saved, setSaved] = useState('');
  const [hoursSaved, setHoursSaved] = useState('');
  const [hoursError, setHoursError] = useState('');
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (account?.whatsappPhoneNumberId) setPhoneId(account.whatsappPhoneNumberId);
    if (account) setHours(normalizeHours(account.openingHours));
    dashboardApi.integrations().then((data) => {
      setIntegrations({
        stripe: data.stripe.configured,
        wa: data.whatsapp.configured,
      });
    });
  }, [account]);

  if (!account) return null;

  const since = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString('pt-BR')
    : '—';

  const patchDay = (index: number, patch: Partial<DaySchedule>) => {
    setHours((prev) =>
      prev.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
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
        <Text style={styles.cardTitle}>Horário de funcionamento</Text>
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
                style={[styles.toggle, day.open ? styles.toggleOn : styles.toggleOff]}
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
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Não foi possível salvar.';
              setHoursError(message);
            } finally {
              setSavingHours(false);
            }
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gateway de pagamento — Stripe</Text>
        <Text style={styles.help}>
          Status:{' '}
          <Text
            style={[styles.badge, integrations.stripe ? styles.on : styles.off]}
          >
            {integrations.stripe ? 'configurado' : 'modo demonstração'}
          </Text>
          . Para receber de verdade, configure{' '}
          <Text style={styles.code}>STRIPE_SECRET_KEY</Text> e{' '}
          <Text style={styles.code}>STRIPE_WEBHOOK_SECRET</Text> nas variáveis de
          ambiente do servidor (e opcionalmente{' '}
          <Text style={styles.code}>STRIPE_PUBLISHABLE_KEY</Text>).
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bot do WhatsApp</Text>
        <Text style={[styles.help, { marginBottom: 16 }]}>
          Status do bot:{' '}
          <Text style={[styles.badge, integrations.wa ? styles.on : styles.off]}>
            {integrations.wa ? 'ligado' : 'desligado'}
          </Text>
          . Configure as variáveis do WhatsApp no servidor e informe abaixo o{' '}
          <Text style={{ fontWeight: '700' }}>Phone Number ID</Text> da Meta
          para ligar esse número a este painel.
        </Text>
        <SofInput
          label="WhatsApp Phone Number ID"
          value={phoneId}
          onChangeText={setPhoneId}
          theme="dashboard"
          placeholder="Ex: 123456789012345"
        />
        {saved ? <Text style={styles.saved}>{saved}</Text> : null}
        <SofButton
          title="Salvar"
          variant="dark"
          theme="dashboard"
          onPress={async () => {
            const { account: updated } = await dashboardApi.updateAccount({
              whatsappPhoneNumberId: phoneId.trim(),
            });
            await setSession(updated);
            setSaved('Salvo!');
            setTimeout(() => setSaved(''), 2000);
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
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  meta: { minWidth: 160, flexGrow: 1, flexBasis: 160 },
  metaLabel: { color: d.muted, fontSize: 13, marginBottom: 4 },
  metaValue: { fontWeight: '700', fontSize: 15, color: d.ink },
  help: { color: d.muted, fontSize: 14, lineHeight: 22 },
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
});
