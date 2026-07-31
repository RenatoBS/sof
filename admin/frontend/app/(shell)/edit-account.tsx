import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '@/src/api/client';
import {
  accountsApi,
  plansApi,
  type AccountRow,
  type PlanRow,
} from '@/src/api/endpoints';
import { Button, ErrorText, Field } from '@/src/components/ui';
import { maskBrPhone, normalizePhoneDigits } from '@/src/lib/validation';
import { colors, fonts, space } from '@/src/theme/admin';

function paramId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

type WaStatus = {
  pairingAvailable: boolean;
  hasInstance: boolean;
  instanceId: string;
  connected: boolean;
  connectedAt: string | null;
  liveStatus: string | null;
  phone: string | null;
  qrcode: string | null;
  paircode: string | null;
};

export default function AccountDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramId(params.id);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [stats, setStats] = useState({ employees: 0, appointments: 0 });
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [wa, setWa] = useState<WaStatus | null>(null);
  const [waError, setWaError] = useState('');
  const [waBusy, setWaBusy] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMode, setWaMode] = useState<'qrcode' | 'paircode'>('qrcode');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadWa = useCallback(async () => {
    if (!id) return;
    const res = await accountsApi.whatsappStatus(id);
    setWa(res);
    if (res.connected) stopPoll();
    return res;
  }, [id, stopPoll]);

  const load = useCallback(async () => {
    if (!id) {
      setError('Conta inválida.');
      return;
    }
    const [detail, planList] = await Promise.all([
      accountsApi.get(id),
      plansApi.list(),
    ]);
    setAccount(detail.account);
    setStats(detail.stats);
    setPlans(planList.plans);
    setBusinessName(detail.account.businessName);
    setOwnerName(detail.account.ownerName);
    setEmail(detail.account.email);
    setPhone(maskBrPhone(detail.account.phone || ''));
    setPlan(detail.account.plan);
    setPlanPrice(String(detail.account.planPrice));
    setStatus(detail.account.status);
    try {
      await loadWa();
    } catch {
      setWa(null);
    }
  }, [id, loadWa]);

  useEffect(() => {
    load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar.'),
    );
    return () => stopPoll();
  }, [load, stopPoll]);

  function startPoll() {
    stopPoll();
    pollRef.current = setInterval(() => {
      loadWa().catch(() => undefined);
    }, 4000);
  }

  async function save() {
    if (!id) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await accountsApi.update(id, {
        businessName,
        ownerName,
        email,
        phone: normalizePhoneDigits(phone),
        plan,
        planPrice: Number(planPrice),
        status,
      });
      setAccount(res.account);
      setMessage('Salvo.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await accountsApi.resetPassword(id);
      setMessage(`Nova senha temporária: ${res.temporaryPassword}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao resetar senha.');
    } finally {
      setBusy(false);
    }
  }

  async function waConnect(withPhone: boolean) {
    if (!id) return;
    setWaBusy(true);
    setWaError('');
    try {
      const res = await accountsApi.whatsappConnect(
        id,
        withPhone ? { phone: normalizePhoneDigits(waPhone) } : undefined,
      );
      setWaMode(res.mode);
      await loadWa();
      if (res.status !== 'connected') startPoll();
      setMessage(
        res.status === 'connected'
          ? 'WhatsApp conectado.'
          : withPhone
            ? 'Código gerado — peça ao cliente para digitar no WhatsApp.'
            : 'QR gerado — peça ao cliente para escanear.',
      );
    } catch (e) {
      setWaError(e instanceof ApiError ? e.message : 'Falha ao conectar.');
    } finally {
      setWaBusy(false);
    }
  }

  async function waDisconnect() {
    if (!id) return;
    const ok =
      Platform.OS === 'web'
        ? window.confirm('Desconectar WhatsApp desta conta?')
        : true;
    if (!ok) return;
    setWaBusy(true);
    setWaError('');
    try {
      await accountsApi.whatsappDisconnect(id);
      stopPoll();
      await loadWa();
      setMessage('WhatsApp desconectado.');
    } catch (e) {
      setWaError(e instanceof ApiError ? e.message : 'Falha ao desconectar.');
    } finally {
      setWaBusy(false);
    }
  }

  async function waRecreate() {
    if (!id) return;
    const ok =
      Platform.OS === 'web'
        ? window.confirm(
            'Recriar instância Uazapi? O cliente precisará parear de novo.',
          )
        : true;
    if (!ok) return;
    setWaBusy(true);
    setWaError('');
    try {
      await accountsApi.whatsappRecreate(id);
      stopPoll();
      await loadWa();
      setMessage('Instância recriada — use Conectar para gerar QR.');
    } catch (e) {
      setWaError(e instanceof ApiError ? e.message : 'Falha ao recriar.');
    } finally {
      setWaBusy(false);
    }
  }

  async function waClear() {
    if (!id) return;
    setWaBusy(true);
    setWaError('');
    try {
      await accountsApi.whatsappClear(id);
      await loadWa();
      setMessage('Estado local limpo (connectedAt).');
    } catch (e) {
      setWaError(e instanceof ApiError ? e.message : 'Falha ao limpar.');
    } finally {
      setWaBusy(false);
    }
  }

  if (!account && !error) {
    return <Text style={{ color: colors.muted }}>Carregando…</Text>;
  }

  const liveLabel = wa?.liveStatus || (wa?.connected ? 'connected' : '—');

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Button title="← Contas" variant="ghost" onPress={() => router.back()} />
      <Text style={styles.title}>{account?.businessName || 'Conta'}</Text>
      <Text style={styles.sub}>
        {stats.employees} profissionais · {stats.appointments} agendamentos
        {account?.whatsappConnected ? ' · WhatsApp conectado' : ''}
      </Text>

      <Field label="Negócio" value={businessName} onChangeText={setBusinessName} />
      <Field label="Responsável" value={ownerName} onChangeText={setOwnerName} />
      <Field label="E-mail" mask="email" value={email} onChangeText={setEmail} />
      <Field
        label="Telefone"
        mask="phone"
        placeholder="(11) 99999-8888"
        value={phone}
        onChangeText={setPhone}
      />
      <Text style={styles.label}>Plano</Text>
      <View style={styles.chips}>
        {plans.map((p) => (
          <Button
            key={p.id}
            title={p.name}
            variant={plan === p.name ? 'primary' : 'ghost'}
            onPress={() => {
              setPlan(p.name);
              setPlanPrice(String(p.price));
            }}
          />
        ))}
      </View>
      <Field
        label="Preço (R$)"
        keyboardType="decimal-pad"
        value={planPrice}
        onChangeText={setPlanPrice}
      />
      <Text style={styles.label}>Status</Text>
      <View style={styles.chips}>
        <Button
          title="active"
          variant={status === 'active' ? 'primary' : 'ghost'}
          onPress={() => setStatus('active')}
        />
        <Button
          title="suspended"
          variant={status === 'suspended' ? 'primary' : 'ghost'}
          onPress={() => setStatus('suspended')}
        />
      </View>

      <View style={styles.waBox}>
        <Text style={styles.waTitle}>WhatsApp (Uazapi)</Text>
        {!wa ? (
          <Text style={styles.waMeta}>Carregando status…</Text>
        ) : (
          <>
            <Text style={styles.waMeta}>
              Servidor:{' '}
              {wa.pairingAvailable ? 'configurado' : 'não configurado no admin-api'}
            </Text>
            <Text style={styles.waMeta}>
              Dispositivo: {liveLabel}
              {wa.connected ? ' · conectado' : ' · desconectado'}
            </Text>
            {wa.instanceId ? (
              <Text style={styles.waCode}>Instance: {wa.instanceId}</Text>
            ) : (
              <Text style={styles.waMeta}>Sem instance id</Text>
            )}
            {wa.phone ? (
              <Text style={styles.waMeta}>Telefone WA: {wa.phone}</Text>
            ) : null}
          </>
        )}

        <ErrorText>{waError}</ErrorText>

        {wa?.qrcode && !wa.connected && waMode === 'qrcode' ? (
          <View style={styles.qrWrap}>
            <Image
              source={{ uri: wa.qrcode }}
              style={styles.qr}
              accessibilityLabel="QR Code WhatsApp"
            />
          </View>
        ) : null}
        {wa?.paircode && !wa.connected ? (
          <Text style={styles.pairCode}>{wa.paircode}</Text>
        ) : null}

        {waMode === 'paircode' && !wa?.connected ? (
          <Field
            label="Telefone do aparelho (DDI)"
            mask="phoneDdi"
            value={waPhone}
            onChangeText={setWaPhone}
            placeholder="+55 (11) 99999-8888"
          />
        ) : null}

        <View style={styles.waActions}>
          <Button
            title="Atualizar"
            variant="ghost"
            disabled={waBusy || !id}
            onPress={() =>
              loadWa().catch((e) =>
                setWaError(
                  e instanceof ApiError ? e.message : 'Falha no status.',
                ),
              )
            }
          />
          <Button
            title={waBusy ? '…' : 'Conectar QR'}
            disabled={waBusy || !wa?.pairingAvailable}
            onPress={() => {
              setWaMode('qrcode');
              waConnect(false);
            }}
          />
          <Button
            title="Código"
            variant="ghost"
            disabled={waBusy || !wa?.pairingAvailable}
            onPress={() => {
              setWaMode('paircode');
              if (normalizePhoneDigits(waPhone).length >= 10) waConnect(true);
            }}
          />
          {waMode === 'paircode' ? (
            <Button
              title="Gerar código"
              disabled={waBusy || normalizePhoneDigits(waPhone).length < 10}
              onPress={() => waConnect(true)}
            />
          ) : null}
          <Button
            title="Desconectar"
            variant="danger"
            disabled={waBusy || !wa?.hasInstance}
            onPress={waDisconnect}
          />
          <Button
            title="Recriar"
            variant="ghost"
            disabled={waBusy || !wa?.pairingAvailable}
            onPress={waRecreate}
          />
          <Button
            title="Limpar flag"
            variant="ghost"
            disabled={waBusy}
            onPress={waClear}
          />
        </View>
        {waBusy ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
        ) : null}
      </View>

      <ErrorText>{error}</ErrorText>
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      <View style={styles.actions}>
        <Button
          title="Resetar senha"
          variant="danger"
          onPress={resetPassword}
          disabled={busy}
        />
        <Button title={busy ? 'Salvando…' : 'Salvar'} onPress={save} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 48, maxWidth: 560, gap: 0 },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
    marginTop: space.md,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginBottom: space.lg,
    marginTop: 4,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.muted,
    marginBottom: space.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.lg,
  },
  ok: {
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
    marginTop: space.sm,
  },
  waBox: {
    marginTop: space.xl,
    marginBottom: space.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.paper,
    gap: 6,
  },
  waTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 4,
  },
  waMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  waCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.ink,
    marginTop: 2,
  },
  waActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  qrWrap: { alignItems: 'center', marginVertical: space.md },
  qr: { width: 200, height: 200, borderRadius: 8 },
  pairCode: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    letterSpacing: 4,
    textAlign: 'center',
    marginVertical: space.md,
    color: colors.ink,
  },
});
