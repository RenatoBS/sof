import { m } from '@/src/theme/marketing';

/** Tokens do painel (Operate). Tipografia alinhada ao marketing; accent próprio para scanabilidade. */
export const d = {
  ink: '#1a202c',
  muted: '#64748b',
  mutedStrong: '#475569',
  line: '#e2e8f0',
  lineStrong: '#cbd5e1',
  paper: '#fafbfc',
  surface: '#ffffff',
  accent: '#3b82f6',
  accentSoft: '#eff6ff',
  fill: '#f1f5f9',
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
      shadowColor: '#1a202c',
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
