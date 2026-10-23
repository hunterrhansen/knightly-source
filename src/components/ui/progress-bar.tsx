import { View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';

/** A rounded fill of `value` out of `max`: unlock progress, a tactic's
 * first-try rate. `weak` marks the one bar a list wants you to look at
 * (pair it with a word, never colour alone). Lessons use LessonTopBar. */
export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  label,
  size = 'md',
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'weak';
  /** Spoken name, e.g. "Forks first-try rate". */
  label: string;
  size?: 'sm' | 'md';
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      style={styles.track(size)}
    >
      <View
        style={[
          styles.fill(size),
          {
            width: `${share * 100}%`,
            backgroundColor:
              tone === 'weak' ? theme.colors.weak : theme.colors.brand,
          },
        ]}
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  track: (size: 'sm' | 'md') => ({
    height: size === 'sm' ? 10 : 12,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  }),
  fill: (size: 'sm' | 'md') => ({
    height: size === 'sm' ? 10 : 12,
    borderRadius: theme.radius.control,
  }),
}));
