import { StyleSheet, Text, View } from 'react-native';
import { m } from '@/src/theme/marketing';

export function SoftChatCard() {
  return (
    <View style={[styles.card, m.shadow.lift]}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>S</Text>
        </View>
        <View>
          <Text style={styles.name}>Sof</Text>
          <Text style={styles.status}>online</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.msg, styles.them]}>
          <Text style={styles.msgText}>Oi! Qual serviço você quer agendar?</Text>
        </View>
        <View style={styles.chips}>
          {['Corte', 'Barba', 'Corte + barba'].map((c) => (
            <View key={c} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.msg, styles.me]}>
          <Text style={[styles.msgText, styles.meText]}>Corte + barba</Text>
        </View>
        <View style={[styles.msg, styles.them]}>
          <Text style={styles.msgText}>Com o Marcelo, quinta às 15:00. Fecha?</Text>
        </View>
        <View style={[styles.msg, styles.me]}>
          <Text style={[styles.msgText, styles.meText]}>Fecha</Text>
        </View>
        <View style={[styles.msg, styles.them]}>
          <Text style={styles.msgText}>
            Marcado. Você recebe um lembrete uma hora antes.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: m.surface,
    borderRadius: m.radius,
    padding: 22,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: m.line,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: m.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: m.fonts.displayBold,
    color: m.accentInk,
    fontSize: 14,
  },
  name: { fontFamily: m.fonts.display, fontSize: 16, color: m.ink },
  status: { fontSize: 13, color: m.accentInk },
  body: { paddingTop: 18, gap: 10 },
  msg: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  them: {
    backgroundColor: m.paper,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  me: {
    backgroundColor: m.accent,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  msgText: { fontSize: 14, lineHeight: 20, color: m.ink, fontFamily: m.fonts.body },
  meText: { color: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: m.surface,
    borderWidth: 1,
    borderColor: m.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  chipText: { fontSize: 13, color: m.accentInk, fontWeight: '500' },
});
