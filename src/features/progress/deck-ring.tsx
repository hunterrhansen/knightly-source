import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';

const SIZE = 96;
const STROKE = 10;

/** Moves as a ring: each segment's share of `total` in its colour, the
 * rest the bare track, with one count in the middle (Progress's "Your
 * moves": stopped slipping gold, held green, on watch sky). */
export function DeckRing({
  segments,
  total: count,
  center,
  accessibilityLabel,
}: {
  segments: readonly { value: number; color: string }[];
  total: number;
  center: { count: number; label: string };
  accessibilityLabel: string;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(1, count);
  let start = 0;
  return (
    <View
      style={styles.ring}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke={theme.colors.line}
          strokeWidth={STROKE}
        />
        {segments.map(({ value, color }) => {
          const length = (value / total) * circumference;
          const offset = start;
          start += length;
          return value > 0 ? (
            <Circle
              key={color}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          ) : null;
        })}
      </Svg>
      <View style={styles.center} aria-hidden>
        <Text style={styles.count}>{center.count}</Text>
        <Text style={styles.label}>{center.label}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  ring: { width: SIZE, height: SIZE },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 24,
    lineHeight: 28,
  },
  label: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 11,
  },
}));
