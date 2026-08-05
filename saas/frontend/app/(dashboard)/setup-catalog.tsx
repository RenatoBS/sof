import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/src/auth/AuthProvider';
import { useDashboard } from '@/src/context/DashboardContext';
import { ServiceFormModal } from '@/src/features/services/ServiceFormModal';
import { ProductFormModal } from '@/src/features/products/ProductFormModal';
import {
  SofCard,
  SofPageHeader,
} from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';
import type { Product, Service } from '@/src/api/types';

type Kind = 'service' | 'product' | null;

export default function SetupCatalogScreen() {
  const { refreshMe } = useAuth();
  const { services, products, setServices, setProducts, loading } =
    useDashboard();
  const [kind, setKind] = useState<Kind>(null);

  const needsSetup = !loading && services.length + products.length === 0;

  useEffect(() => {
    if (!loading && services.length + products.length > 0) {
      router.replace('/(dashboard)/agenda');
    }
  }, [loading, services.length, products.length]);

  if (!needsSetup && !loading) {
    return <Redirect href={'/(dashboard)/agenda' as '/'} />;
  }

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Configure seu catálogo"
        subtitle="Cadastre pelo menos um serviço ou um produto para começar a usar a Sof."
      />
      <SofCard>
        <Text style={styles.lead}>
          O bot WhatsApp e o painel precisam de algo para oferecer aos clientes.
          Escolha por onde começar — você pode complementar depois.
        </Text>
        <View style={styles.choices}>
          <Pressable
            style={[styles.choice, kind === 'service' && styles.choiceOn]}
            onPress={() => setKind('service')}
          >
            <Text
              style={[
                styles.choiceTitle,
                kind === 'service' && styles.choiceTitleOn,
              ]}
            >
              Serviço
            </Text>
            <Text
              style={[
                styles.choiceBody,
                kind === 'service' && styles.choiceBodyOn,
              ]}
            >
              Agendamento com duração e profissional
            </Text>
          </Pressable>
          <Pressable
            style={[styles.choice, kind === 'product' && styles.choiceOn]}
            onPress={() => setKind('product')}
          >
            <Text
              style={[
                styles.choiceTitle,
                kind === 'product' && styles.choiceTitleOn,
              ]}
            >
              Produto
            </Text>
            <Text
              style={[
                styles.choiceBody,
                kind === 'product' && styles.choiceBodyOn,
              ]}
            >
              Venda pelo WhatsApp (pedido sem pagamento online)
            </Text>
          </Pressable>
        </View>
      </SofCard>

      <ServiceFormModal
        visible={kind === 'service'}
        onClose={() => setKind(null)}
        onSaved={async (service: Service) => {
          setServices((prev) =>
            prev.some((s) => s.id === service.id)
              ? prev.map((s) => (s.id === service.id ? service : s))
              : [...prev, service],
          );
          await refreshMe();
          router.replace('/(dashboard)/agenda');
        }}
      />
      <ProductFormModal
        visible={kind === 'product'}
        onClose={() => setKind(null)}
        onSaved={async (product: Product) => {
          setProducts((prev) =>
            prev.some((p) => p.id === product.id)
              ? prev.map((p) => (p.id === product.id ? product : p))
              : [...prev, product],
          );
          await refreshMe();
          router.replace('/(dashboard)/agenda');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: 16, paddingBottom: 24 },
  lead: {
    color: d.muted,
    fontSize: 14,
    fontFamily: d.fonts.body,
    lineHeight: 20,
    marginBottom: 12,
  },
  choices: { gap: 10, marginBottom: 12 },
  choice: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 14,
    padding: 14,
    backgroundColor: d.surface,
    gap: 4,
  },
  choiceOn: { backgroundColor: d.ink, borderColor: d.ink },
  choiceTitle: {
    color: d.ink,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: d.fonts.displayBold,
  },
  choiceTitleOn: { color: '#fff' },
  choiceBody: { color: d.muted, fontSize: 13, fontFamily: d.fonts.body },
  choiceBodyOn: { color: 'rgba(255,255,255,0.8)' },
});
