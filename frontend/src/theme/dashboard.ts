import { m } from '@/src/theme/marketing';

/** Tokens do painel (Operate) — mesma marca Sof; fundos claros para scanabilidade. */
export const d = {
  ink: m.ink,
  muted: m.muted,
  mutedStrong: '#4A5450',
  line: m.line,
  lineStrong: '#CDD2CF',
  paper: '#F7F8F7',
  surface: m.surface,
  accent: m.accent,
  accentSoft: m.accentSoft,
  copper: m.copper,
  copperInk: m.copperInk,
  copperSoft: m.copperSoft,
  fill: '#EEF0EF',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  waGreen: '#25D366',
  waGreenText: '#0d9c53',
  radius: 12,
  radiusSm: 8,
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  shadow: {
    soft: {
      shadowColor: m.ink,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.04,
      shadowRadius: 16,
      elevation: 2,
    },
  },
  fonts: {
    display: m.fonts.display,
    displayBold: m.fonts.displayBold,
    body: m.fonts.body,
    bodyMedium: m.fonts.bodyMedium,
  },
};
