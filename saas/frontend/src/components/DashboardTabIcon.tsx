import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type DashboardTabIconName =
  | 'agenda'
  | 'employees'
  | 'services'
  | 'clients'
  | 'handoffs'
  | 'billing'
  | 'account';

export function DashboardTabIcon({
  name,
  color,
  size = 16,
}: {
  name: DashboardTabIconName;
  color: string;
  size?: number;
}) {
  const common = {
    stroke: color,
    fill: 'none' as const,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'agenda':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <Rect {...common} x={3} y={4} width={18} height={17} rx={2} />
          <Path {...common} d="M3 9h18M8 2v4M16 2v4" />
        </Svg>
      );
    case 'employees':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <Circle {...common} cx={9} cy={7} r={3} />
          <Path {...common} d="M3 19c0-3 2.5-5.5 6-5.5" />
          <Circle {...common} cx={17} cy={9} r={2.5} />
          <Path {...common} d="M14 19c0-2.5 2-4.5 4.5-4.5" />
        </Svg>
      );
    case 'services':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <Path {...common} d="M8 6h13M8 12h13M8 18h13" />
          <Path {...common} d="M3 6h.01M3 12h.01M3 18h.01" />
        </Svg>
      );
    case 'clients':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <Circle {...common} cx={12} cy={8} r={4} />
          <Path {...common} d="M5 20c0-4 3.1-7 7-7s7 3 7 7" />
        </Svg>
      );
    case 'handoffs':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <Path
            {...common}
            d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.5 8.5 0 1 1 21 11.5Z"
          />
        </Svg>
      );
    case 'billing':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <Path {...common} d="M3 3v18h18" />
          <Path {...common} d="M7 16l4-5 3 3 5-7" />
        </Svg>
      );
    case 'account':
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <Circle {...common} cx={12} cy={12} r={3} />
          <Path
            {...common}
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </Svg>
      );
    default:
      return null;
  }
}
