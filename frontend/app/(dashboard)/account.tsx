import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { dashboardApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export default function AccountScreen() {
  const { account, logout } = useAuth();
  const [phoneId, setPhoneId] = useState('');
  const [integrations, setIntegrations] = useState({ mp: false, wa: false });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (account?.whatsappPhoneNumberId) setPhoneId(account.whatsappPhoneNumberId);
    dashboardApi.integrations().then((data) => {
      setIntegrations({
        mp: data.mercadoPago.configured,
        wa: data.whatsapp.configured,
      });
    });
  }, [account]);

  if (!account) return null;

  const since = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString('pt-BR')
    : '—';

  return (
    <View style={styles.page}>
      <View>
        <Text style={styles.h2}>Sua conta</Text>
        <Text style={styles.sub}>Plano, credenciais e integrações</Text>
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
        <Text style={styles.cardTitle}>Gateway de pagamento — Mercado Pago</Text>
        <Text style={styles.help}>
          Status:{' '}
          <Text style={[styles.badge, integrations.mp ? styles.on : styles.off]}>
            {integrations.mp ? 'configurado' : 'modo demonstração'}
          </Text>
          . Para receber de verdade, configure{' '}
          <Text style={styles.code}>MP_ACCESS_TOKEN</Text>,{' '}
          <Text style={styles.code}>MP_PUBLIC_KEY</Text> e{' '}
          <Text style={styles.code}>MP_WEBHOOK_SECRET</Text> nas variáveis de
          ambiente do servidor.
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
            await dashboardApi.updateAccount({
              whatsappPhoneNumberId: phoneId.trim(),
            });
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
});
