import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { d } from '@/src/theme/dashboard';

/** Avatar/logo do estabelecimento (header ou Conta). */
export function BusinessLogo({
  uri,
  initials,
  size = 40,
  style,
}: {
  uri?: string | null;
  initials?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const radius = Math.max(8, Math.round(size * 0.28));
  const hasLogo = Boolean(uri && uri.startsWith('data:image/'));

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Logo do estabelecimento"
    >
      {hasLogo ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
          {(initials || 'S').slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: d.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: d.line,
    flexShrink: 0,
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: d.fonts.displayBold,
    letterSpacing: 0.4,
  },
});
