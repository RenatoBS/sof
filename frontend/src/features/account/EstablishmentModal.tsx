import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Account } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { BusinessLogo } from '@/src/components/BusinessLogo';
import { SofButton, SofInput } from '@/src/components/ui';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';
import { fileToLogoDataUrl } from '@/src/lib/logo';
import {
  isValidPhoneDigits,
  maskBrPhone,
  normalizePhoneDigits,
} from '@/src/lib/validation';
import { d } from '@/src/theme/dashboard';

type EstablishmentModalProps = {
  visible: boolean;
  onClose: () => void;
  account: Account;
};

export function EstablishmentModal({
  visible,
  onClose,
  account,
}: EstablishmentModalProps) {
  const { setSession } = useAuth();
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoSaved, setLogoSaved] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPhone(maskBrPhone(account.phone || ''));
    setAddress(account.address || '');
    setError('');
    setLogoError('');
    setLogoSaved('');
    setLoading(false);
    setLogoBusy(false);
  }, [visible, account]);

  const initials = (account.businessName || 'S')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const pickLogo = () => {
    setLogoError('');
    setLogoSaved('');
    if (Platform.OS !== 'web') {
      setLogoError(
        'O upload de logo está disponível no painel web por enquanto.',
      );
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setLogoBusy(true);
      setLogoError('');
      setLogoSaved('');
      try {
        const dataUrl = await fileToLogoDataUrl(file);
        const { account: updated } = await dashboardApi.updateAccount({
          logoBase64: dataUrl,
        });
        await setSession(updated);
        setLogoSaved('Logo atualizado.');
      } catch (err) {
        setLogoError(
          err instanceof Error ? err.message : 'Falha ao enviar o logo.',
        );
      } finally {
        setLogoBusy(false);
      }
    };
    input.click();
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    setLogoError('');
    setLogoSaved('');
    try {
      const { account: updated } = await dashboardApi.updateAccount({
        logoBase64: '',
      });
      await setSession(updated);
      setLogoSaved('Logo removido.');
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : 'Falha ao remover o logo.',
      );
    } finally {
      setLogoBusy(false);
    }
  };

  const save = async () => {
    setError('');
    const digits = normalizePhoneDigits(phone);
    if (!isValidPhoneDigits(digits)) {
      setError('Telefone inválido. Use DDD + número (10 a 15 dígitos).');
      return;
    }
    setLoading(true);
    try {
      const { account: updated } = await dashboardApi.updateAccount({
        phone: digits,
        address: address.trim(),
      });
      await setSession(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title="Estabelecimento"
      hint="Logo, telefone e endereço usados no bot e no painel."
      actions={
        <>
          <SofButton
            title={loading ? 'Salvando…' : 'Salvar'}
            variant="dark"
            theme="dashboard"
            onPress={save}
            loading={loading}
            disabled={loading || logoBusy}
          />
          <SofButton
            title="Fechar"
            variant="light"
            theme="dashboard"
            onPress={onClose}
            disabled={loading || logoBusy}
          />
        </>
      }
    >
      <View style={styles.logoRow}>
        <Pressable
          onPress={pickLogo}
          disabled={logoBusy}
          accessibilityRole="button"
          accessibilityLabel="Alterar logo do estabelecimento"
          style={({ pressed }) => [
            styles.avatarPress,
            pressed && { opacity: 0.9 },
          ]}
        >
          <BusinessLogo
            uri={account.logoBase64}
            initials={initials}
            size={72}
          />
          {logoBusy ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={styles.logoCopy}>
          <Text style={styles.business} numberOfLines={2}>
            {account.businessName || 'Sua conta'}
          </Text>
          {account.ownerName ? (
            <Text style={styles.owner} numberOfLines={1}>
              Responsável: {account.ownerName}
            </Text>
          ) : null}
          <View style={styles.logoActions}>
            <SofButton
              title="Enviar logo"
              variant="light"
              theme="dashboard"
              onPress={pickLogo}
              disabled={logoBusy}
              loading={logoBusy}
            />
            {account.logoBase64 ? (
              <SofButton
                title="Remover"
                variant="danger"
                theme="dashboard"
                onPress={removeLogo}
                disabled={logoBusy}
              />
            ) : null}
          </View>
          <Text style={styles.logoHint}>PNG, JPEG, WebP ou GIF · até 5 MB</Text>
          {logoError ? <Text style={styles.error}>{logoError}</Text> : null}
          {logoSaved ? <Text style={styles.saved}>{logoSaved}</Text> : null}
        </View>
      </View>

      <SofInput
        label="Telefone (com DDD)"
        value={phone}
        onChangeText={(t) => {
          setPhone(maskBrPhone(t));
          setError('');
        }}
        theme="dashboard"
        placeholder="(11) 99999-8888"
        keyboardType="phone-pad"
      />
      <SofInput
        label="Endereço"
        value={address}
        onChangeText={(t) => {
          setAddress(t);
          setError('');
        }}
        theme="dashboard"
        placeholder="Rua Exemplo, 123 — Bairro, Cidade"
        autoCapitalize="words"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </EntityFormModal>
  );
}

const styles = StyleSheet.create({
  logoRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarPress: {
    position: 'relative',
    borderRadius: 40,
    overflow: 'hidden',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCopy: { flex: 1, minWidth: 0, gap: 6 },
  business: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
  },
  owner: { color: d.muted, fontSize: 13, fontFamily: d.fonts.body },
  logoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  logoHint: { color: d.muted, fontSize: 12, fontFamily: d.fonts.body },
  error: { color: d.danger, fontSize: 13, fontFamily: d.fonts.body },
  saved: { color: d.accent, fontSize: 13, fontFamily: d.fonts.body },
});
