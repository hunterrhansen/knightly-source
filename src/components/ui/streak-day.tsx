import { Text, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { moonPhaseForNight } from '../kit/art/moon-phase-art';
import { PopIn } from './celebration-motion';
import { MoonPhase } from './moon-phase';
import { Sparkles, useRewardMoment } from './reward-effects';
import type { StreakDayState } from './streak-calendar-model';

export const STREAK_DAY = 32;

/** One day of the streak: that night's moon phase when practiced, today's
 * dashed socket (gold in its last hours), a frozen day's blue ring, and
 * otherwise a quiet cell. Missed days stay plain, never red. Shared by the
 * calendar and Progress's four-week grid. */
export function StreakDay({
  label,
  accessibilityLabel,
  state,
  faded,
  landingDelay,
  night,
  atRisk,
}: {
  label: string;
  accessibilityLabel: string;
  state: StreakDayState;
  faded: boolean;
  landingDelay?: number;
  /** A done day's night in its streak; unknown shows the full moon. */
  night?: number;
  atRisk: boolean;
}) {
  const styles = useStyles();
  if (state === 'done' && landingDelay !== undefined)
    return (
      <LandingDay
        accessibilityLabel={accessibilityLabel}
        delay={landingDelay}
        night={night}
      />
    );
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.dot,
        state === 'done' && styles.dotDone,
        state === 'today' && styles.dotToday,
        state === 'today' && atRisk && styles.dotRisk,
        state === 'frozen' && styles.dotFrozen,
        state === 'missed' && styles.dotMissed,
        faded && styles.faded,
      ]}
    >
      {state === 'done' ? (
        <MoonPhase size={STREAK_DAY} day={moonPhaseForNight(night)} />
      ) : (
        <Text
          style={[
            styles.number,
            state === 'upcoming' && styles.numberMuted,
            state === 'none' && styles.numberMuted,
            state === 'frozen' && styles.numberFrozen,
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

/** Today's moon dropping into its socket after `delay` ms; it lights up
 * with sparkles and the land cue as it touches down. */
function LandingDay({
  accessibilityLabel,
  delay,
  night,
}: {
  accessibilityLabel: string;
  delay: number;
  night?: number;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const lit = useRewardMoment(delay + tokens.motion.celebrate * 0.45, 'land');
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.dot, styles.dotToday]}
    >
      <View style={styles.landing}>
        <PopIn bounce delay={delay}>
          <View style={[styles.dot, styles.dotDone]}>
            <MoonPhase size={STREAK_DAY} day={moonPhaseForNight(night)} />
          </View>
        </PopIn>
      </View>
      <Sparkles fire={lit} color={theme.colors.gold} reach={30} />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  dot: {
    width: STREAK_DAY,
    height: STREAK_DAY,
    borderRadius: STREAK_DAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  // The moon art brings its own disc and outline.
  dotDone: { backgroundColor: 'transparent' },
  // Today's empty socket, as in the streak hero.
  dotToday: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.inkMuted,
  },
  dotRisk: { borderColor: theme.colors.goldLedge },
  dotFrozen: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.sky,
  },
  dotMissed: { backgroundColor: 'transparent' },
  // Over the ringed dot, the size of a plain one.
  landing: { position: 'absolute', top: -2, left: -2 },
  faded: { opacity: 0.35 },
  number: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 12,
  },
  numberMuted: { color: theme.colors.inkMuted },
  numberFrozen: { color: theme.colors.sky },
}));
