import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { dashboardApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { SoftButton, SoftInput } from '@/src/components/ui';
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

  return (
    <View style={styles.page}>
      <View>
        <Text style={styles.h2}>Conta</Text>
        <Text style={styles.sub}>Dados da assinatura e integrações</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.line}>
          <Text style={styles.label}>Negócio: </Text>
          {account.businessName}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>E-mail: </Text>
          {account.email}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>Plano: </Text>
          {account.plan} — R$ {account.planPrice}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>Mercado Pago: </Text>
          {integrations.mp ? 'configurado' : 'modo demonstração'}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>WhatsApp API: </Text>
          {integrations.wa ? 'configurado' : 'desligado'}
        </Text>
      </View>

      <View style={styles.card}>
        <SoftInput
          label="WhatsApp Phone Number ID"
          value={phoneId}
          onChangeText={setPhoneId}
          theme="dashboard"
          placeholder="ID do número na Meta"
        />
        {saved ? <Text style={styles.saved}>{saved}</Text> : null}
        <SoftButton
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

      <SoftButton
        title="Sair"
        variant="light"
        theme="dashboard"
        onPress={async () => {
          await logout();
          router.replace('/');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24, maxWidth: 560 },
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
  line: { fontSize: 15, color: d.ink, marginBottom: 4 },
  label: { fontWeight: '600' },
  saved: { color: '#0d9c53', fontWeight: '600' },
});
