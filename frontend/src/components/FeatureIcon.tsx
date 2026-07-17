import Svg, { Path, Rect } from 'react-native-svg';
import { m } from '@/src/theme/marketing';

export function FeatureIcon({ name }: { name: string }) {
  const stroke = m.accentInk;
  const common = { stroke, fill: 'none', strokeWidth: 1.6 };

  switch (name) {
    case 'chat':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path
            {...common}
            d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.5 8.5 0 1 1 21 11.5Z"
          />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Rect {...common} x={3} y={4} width={18} height={17} rx={2} />
          <Path {...common} d="M3 9h18M8 2v4M16 2v4" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path {...common} d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z" />
          <Path {...common} d="M13.7 21a2 2 0 0 1-3.4 0" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path {...common} d="M3 3v18h18" />
          <Path {...common} d="M7 15l4-4 3 3 5-6" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Rect {...common} x={7} y={2} width={10} height={20} rx={2} />
          <Path {...common} d="M11 18h2" />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path
            {...common}
            d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z"
          />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path stroke={m.accent} fill="none" strokeWidth={2} d="M20 6L9 17l-5-5" />
        </Svg>
      );
    default:
      return null;
  }
}
