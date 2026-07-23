import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { Eyebrow, Wrap } from '@/src/components/ui';
import {
  CheckoutModal,
  PricingCards,
  type MarketingPlan,
} from '@/src/features/marketing/CheckoutModal';
import { m } from '@/src/theme/marketing';

export default function PricingScreen() {
  const [checkout, setCheckout] = useState<MarketingPlan | null>(null);

  return (
    <ScrollView style={styles.page}>
      <MarketingNav active="pricing" />
      <View style={styles.section}>
        <Wrap>
          <View style={styles.head}>
            <Eyebrow>Planos</Eyebrow>
            <Text style={styles.h2}>
              Um preço honesto para cada tamanho de operação.
            </Text>
            <Text style={styles.p}>
              Comece pequeno e mude de plano quando fizer sentido. Sem fidelidade,
              cancela quando quiser.
            </Text>
          </View>
          <PricingCards onSelect={setCheckout} />
        </Wrap>
      </View>
      <SiteFooter />
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
  page: { flex: 1, backgroundColor: m.paper },
  section: { paddingTop: 80, paddingBottom: 64 },
  head: { maxWidth: 520, marginBottom: 48, gap: 14 },
  h2: {
    fontFamily: m.fonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.7,
    color: m.ink,
  },
  p: { color: m.muted, fontSize: 17, lineHeight: 26 },
});
