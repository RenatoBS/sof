import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { dashboardApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { Button, Input } from '@/src/components/ui';
import { dashboardColors } from '@/src/theme/dashboard';

export default function AccountScreen() {
  const { account, logout } = useAuth();
  const [phoneId, setPhoneId] = useState('');
  const [integrations, setIntegrations] = useState({
    mp: false,
    wa: false,
  });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (account?.whatsappPhoneNumberId) {
      setPhoneId(account.whatsappPhoneNumberId);
    }
    dashboardApi.integrations().then((data) => {
      setIntegrations({
        mp: data.mercadoPago.configured,
        wa: data.whatsapp.configured,
      });
    });
  }, [account]);

  const save = async () => {
    await dashboardApi.updateAccount({ whatsappPhoneNumberId: phoneId.trim() });
    setSaved('Salvo!');
    setTimeout(() => setSaved(''), 2000);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (!account) return null;

  return (
    <ScrollView style={styles.page}>
      <Text style={styles.title}>Conta</Text>
      <Text style={styles.line}>Negócio: {account.businessName}</Text>
      <Text style={styles.line}>E-mail: {account.email}</Text>
      <Text style={styles.line}>
        Plano: {account.plan} — R$ {account.planPrice}
      </Text>
      <Text style={styles.line}>
        Mercado Pago: {integrations.mp ? 'configurado' : 'demo'}
      </Text>
      <Text style={styles.line}>
        WhatsApp API: {integrations.wa ? 'configurado' : 'desligado'}
      </Text>
      <Input
        label="WhatsApp Phone Number ID"
        value={phoneId}
        onChangeText={setPhoneId}
        placeholder="ID do número na Meta"
      />
      {saved ? <Text style={styles.saved}>{saved}</Text> : null}
      <Button title="Salvar" onPress={save} />
      <Button title="Sair" onPress={handleLogout} variant="ghost" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: dashboardColors.bg, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  line: { marginBottom: 8, color: dashboardColors.ink },
  saved: { color: dashboardColors.success, marginBottom: 8 },
});
