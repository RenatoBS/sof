import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MarketingNav } from '@/src/components/MarketingNav';
import {
  CheckoutModal,
  PricingCards,
} from '@/src/features/marketing/CheckoutModal';
import { marketingColors } from '@/src/theme/marketing';

export default function PricingScreen() {
  const [checkout, setCheckout] = useState<{
    name: string;
    price: number;
  } | null>(null);

  return (
    <ScrollView style={styles.page}>
      <MarketingNav active="pricing" />
      <Text style={styles.title}>Planos</Text>
      <Text style={styles.sub}>Escolha o plano ideal para o seu negócio.</Text>
      <PricingCards
        onSelect={(plan) => setCheckout({ name: plan.name, price: plan.price })}
      />
      <CheckoutModal
        visible={!!checkout}
        planName={checkout?.name || ''}
        price={checkout?.price || 0}
        onClose={() => setCheckout(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: marketingColors.paper, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: marketingColors.ink },
  sub: { color: marketingColors.muted, marginBottom: 20 },
});
