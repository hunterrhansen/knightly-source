import { Stack } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReviewMark } from '../../lib/api/review-contract';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { ActionIcon, type ActionIconName } from './action-icon';
import { BrandMark } from './brand-mark';
import { Button } from './button';
import { FadeIn, PopIn } from './celebration-motion';
import {
  CountUp,
  Shine,
  Sparkles,
  useRewardCue,
  useRewardMoment,
} from './reward-effects';
import { StarShard } from './star-shard';

export type BeatAction = { label: string; onPress: () => void };

// Session-end beats: one idea per full screen, with the primary button held
// back until the entrance lands. Timings are in ms from the beat's mount.
const CARD_GAP = 120;
// When a pop has grown to full size: the moment its sparkles, haptic and
// sound play.
const POP_LANDS = tokens.motion.pop / 2;

/** False until `after` ms have passed since mount; true at once under reduced
 * motion, which shows every beat's final frame. */
function useBeatReady(after: number) {
  const reduced = useSystemReducedMotion();
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), after);
    return () => clearTimeout(timer);
  }, [after]);
  return reduced || elapsed;
}

/** A beat's full-screen frame: centred content that scrolls when large text
 * needs it, and the primary button pinned below once `ready`. Announces
 * `announcement` once when it appears. */
export function BeatFrame({
  children,
  announcement,
  readyAfter,
  hold = false,
  primary,
  secondary,
  top,
}: {
  children: ReactNode;
  /** Above the content, outside the centring (a progress bar). */
  top?: ReactNode;
  announcement: string;
  /** When the entrance has landed, in ms. */
  readyAfter: number;
  /** Keeps the button back for longer (a result still loading). */
  hold?: boolean;
  primary: BeatAction;
  /** A quiet link under the button, gated with it. */
  secondary?: BeatAction;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const ready = useBeatReady(readyAfter) && !hold;
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);
  return (
    <View
      style={[
        styles.frame,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 16 },
      ]}
    >
      {Platform.OS !== 'web' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      {top}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        bounces={false}
      >
        <View style={styles.content}>{children}</View>
      </ScrollView>
      <View style={styles.pinned}>
        {ready && (
          <FadeIn duration={tokens.motion.pop}>
            <View style={styles.actions}>
              <Button onPress={primary.onPress}>{primary.label}</Button>
              {secondary && (
                <Button variant="text" onPress={secondary.onPress}>
                  {secondary.label}
                </Button>
              )}
            </View>
          </FadeIn>
        )}
        {/* Holds the button's room so the content never jumps. */}
        {!ready && <View style={secondary ? styles.slotTall : styles.slot} />}
      </View>
    </View>
  );
}

type StatTone = 'brand' | 'gold' | 'sky';
export type BeatStat = {
  label: string;
  value: string;
  tone: StatTone;
  /** A line icon, or `shard` for the star shard that marks points. */
  icon: ActionIconName | 'shard';
  /** The value as spoken, when it reads differently ("4 minutes 12 seconds"). */
  spoken?: string;
  /** Counts up from 0 to this number after `countDelay` ms (points). */
  countTo?: number;
  countDelay?: number;
};

/** The results beat's points card: gold, marked with the star shard the
 * points are earned as, counting up once the cards land. */
export function pointsStat(total: number): BeatStat {
  return {
    label: 'Points',
    value: String(total),
    countTo: total,
    countDelay: 300,
    tone: 'gold',
    icon: 'shard',
  };
}

/** A coloured header band with a caps label over a surface panel with the
 * icon and value, bordered in the band's colour. A shine sweeps across it once
 * it lands at `landAt` ms; a counting card sparkles and shines again with the
 * reward cue when its count finishes. */
function StatCard({ stat, landAt }: { stat: BeatStat; landAt: number }) {
  const styles = useStyles();
  const { theme } = useTheme();
  const cue = useRewardCue();
  const landed = useRewardMoment(landAt, 'arrive');
  const [counted, setCounted] = useState(0);
  const icon = {
    brand: theme.colors.brandText,
    gold: theme.colors.goldText,
    sky: theme.colors.skyLedge,
  }[stat.tone];
  return (
    <View>
      <View
        accessible
        accessibilityLabel={`${stat.label}: ${stat.spoken ?? stat.value}`}
        style={[styles.card, styles.cardTone(stat.tone)]}
      >
        <Text
          style={[styles.band, styles.bandTone(stat.tone)]}
          numberOfLines={1}
        >
          {stat.label}
        </Text>
        <View style={styles.panel}>
          {stat.icon === 'shard' ? (
            <StarShard size={24} />
          ) : (
            <ActionIcon name={stat.icon} color={icon} size={20} />
          )}
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {stat.countTo === undefined ? (
              stat.value
            ) : (
              <CountUp
                to={stat.countTo}
                delay={stat.countDelay}
                onTick={() => cue('tick')}
                onDone={() => {
                  setCounted(2);
                  cue('reward');
                }}
              />
            )}
          </Text>
        </View>
        <Shine fire={counted || landed} />
      </View>
      <Sparkles fire={counted} color={theme.colors.gold} reach={72} />
    </View>
  );
}

const spoken = (stats: BeatStat[]) =>
  stats.map((s) => `${s.label} ${s.spoken ?? s.value}`).join(', ');

/** The session's results: a title, the coach's line and up to three stat
 * cards, with the per-item list behind "See details". */
export function ResultsBeat({
  title,
  coach,
  stats,
  breakdown,
  details,
  note,
  hold,
  primary,
  secondary,
}: {
  title: string;
  coach: string;
  stats: BeatStat[];
  breakdown?: { label: string; value: string }[];
  details?: ReactNode;
  note?: string;
  hold?: boolean;
  primary: BeatAction;
  secondary?: BeatAction;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const landed = tokens.motion.pop + CARD_GAP * stats.length + 500;
  // The results open on a fanfare as the title pops in.
  useRewardMoment(tokens.motion.pop / 2, 'fanfare');
  // A counting card plays the reward cue when it finishes; otherwise the last
  // card's landing plays the land cue.
  useRewardMoment(
    stats.length && !stats.some((stat) => stat.countTo !== undefined)
      ? CARD_GAP * stats.length + POP_LANDS
      : undefined,
    'land',
  );
  return (
    <BeatFrame
      announcement={`${title}. ${spoken(stats)}`}
      readyAfter={landed}
      hold={hold}
      primary={primary}
      secondary={secondary}
    >
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <View style={styles.coach}>
        <BrandMark size={44} />
        <Text style={styles.coachText}>{coach}</Text>
      </View>
      <View style={styles.cards}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={styles.cardSlot}>
            <PopIn delay={CARD_GAP * (index + 1)}>
              <StatCard
                stat={stat}
                landAt={CARD_GAP * (index + 1) + POP_LANDS}
              />
            </PopIn>
          </View>
        ))}
      </View>
      {!!note && <Text style={styles.note}>{note}</Text>}
      {!!breakdown?.length && (
        <FadeIn delay={CARD_GAP * (stats.length + 1) + 600}>
          <View style={styles.breakdown}>
            {breakdown.map((row) => (
              <View key={row.label} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{row.label}</Text>
                <Text style={styles.breakdownValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </FadeIn>
      )}
      {details && (
        <>
          <Button variant="text" onPress={() => setOpen((value) => !value)}>
            {open ? 'Hide details' : 'See details'}
          </Button>
          {open && <View style={styles.details}>{details}</View>}
        </>
      )}
    </BeatFrame>
  );
}

export type SessionResults = {
  title: string;
  coach: string;
  stats: BeatStat[];
  /** How the points were earned, under the cards ("7 first tries +70"). */
  breakdown?: { label: string; value: string }[];
  details?: ReactNode;
  /** One quiet line under the cards ("12 positions due tomorrow"). */
  note?: string;
  secondary?: BeatAction;
};

/** `m:ss` and its spoken form, from milliseconds. */
export const sessionTime = (ms: number) => {
  const total = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    value: `${minutes}:${String(seconds).padStart(2, '0')}`,
    spoken: minutes
      ? `${unit(minutes, 'minute')}${seconds ? ` ${unit(seconds, 'second')}` : ''}`
      : unit(seconds, 'second'),
  };
};

/** This visit's session time (ms) once `finished`, measured on the device
 * from when it `started`, never sent; a new session after it starts afresh. */
export function useSessionTime(started: boolean, finished: boolean) {
  const timing = useRef<{ start?: number; end?: number }>({});
  if (finished) {
    if (timing.current.start && !timing.current.end)
      timing.current.end = Date.now();
  } else if (timing.current.end) timing.current = {};
  if (started && !finished && !timing.current.start)
    timing.current.start = Date.now();
  const { start, end } = timing.current;
  return start && end ? end - start : undefined;
}

/** The results' last card: this visit's time, or what is left to revisit
 * when the time is unknown (a later visit to a saved session). */
export function timeOrRevisit(
  elapsed: number | undefined,
  label: string,
  count: number,
): BeatStat {
  if (elapsed === undefined)
    return { label, value: String(count), tone: 'sky', icon: 'retry' };
  const time = sessionTime(elapsed);
  return {
    label: 'Time',
    value: time.value,
    spoken: time.spoken,
    tone: 'sky',
    icon: 'clock',
  };
}

/** How a saved answer reads in results, in practice and review. */
export const markLabels: Record<ReviewMark['mark'], string> = {
  found: 'Found',
  good: 'Good move',
  helped: 'With help',
  missed: 'To revisit',
  praise: 'Good move',
  seen: 'Seen',
};

const toneColor = (
  theme: { colors: Record<'brand' | 'gold' | 'sky', string> },
  tone: StatTone,
) => theme.colors[tone];

const useStyles = createStyles((theme) => ({
  frame: { flex: 1, backgroundColor: theme.colors.page },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  pinned: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  actions: { gap: theme.spacing.xs },
  slot: { height: theme.layout.minControl + theme.layout.ledge },
  slotTall: {
    height: theme.layout.minControl * 2 + theme.layout.ledge + theme.spacing.xs,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  coach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  coachText: {
    flexShrink: 1,
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  cards: { flexDirection: 'row', gap: theme.spacing.sm },
  cardSlot: { flex: 1, minWidth: 0 },
  breakdown: {
    gap: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  note: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
    textAlign: 'center',
  },
  breakdownLabel: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  breakdownValue: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    fontVariant: ['tabular-nums'],
  },
  card: {
    overflow: 'hidden',
    borderRadius: theme.radius.control,
    borderWidth: 2,
  },
  cardTone: (tone: StatTone) => ({ borderColor: toneColor(theme, tone) }),
  band: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    textAlign: 'center',
    fontFamily: theme.typography.bold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  bandTone: (tone: StatTone) => ({
    backgroundColor: toneColor(theme, tone),
    color: {
      brand: theme.colors.onBrand,
      gold: theme.colors.onGold,
      sky: theme.colors.onSky,
    }[tone],
  }),
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: 2,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 4,
    borderRadius: theme.radius.control - 4,
    backgroundColor: theme.colors.surface,
  },
  value: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  details: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
}));
