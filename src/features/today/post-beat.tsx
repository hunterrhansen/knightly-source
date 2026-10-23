import { Text, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import {
  type BeatAction,
  BeatFrame,
  Check,
  FadeIn,
  PopIn,
  Sparkles,
  SpriteView,
  useRankEmblem,
  useRewardMoment,
} from '../../ui';
import type { PostMoment } from './ward-path';

// The post beat (docs/specs/2026-10-20-ward-path-design.md, "Moments"): the
// posts this session held, a rank their castle carried when it did, and the
// post the knight walks on to, with its line. Calm and evening-weight: a glow
// and a chime, no confetti.

const AT = { title: 400, rank: 900, next: 1300, ready: 1700 };
const LANDS = tokens.motion.celebrate * 0.45;

/** "The Lists", "The Lists and the Turret Stair", "A, B and C". */
const places = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** Lower-case a leading "The" after the first place, as English reads it. */
const listed = (names: readonly string[]) =>
  places(names.map((n, i) => (i === 0 ? n : n.replace(/^The /, 'the '))));

export function PostBeat({
  posts,
  showRank,
  primary,
}: {
  posts: PostMoment;
  /** The rank its castle carried, unless the stars' rank beat follows. */
  showRank: boolean;
  primary: BeatAction;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const landed = useRewardMoment(LANDS, 'reward');
  const rank = showRank ? posts.rank : null;
  const emblem = useRankEmblem(rank ?? { name: 'Page' });
  const held = posts.cleared.map((p) => p.place);
  const title = held.length
    ? `${listed(held)} ${held.length === 1 ? 'is' : 'are'} held`
    : posts.next
      ? `On to ${posts.next.place}`
      : '';
  const first = posts.cleared[0];
  const story = held.length
    ? `Every lesson there is held. ${held.length === 1 ? 'It stays' : 'They stay'} in your watch, just less often.`
    : null;
  // The last post held is the gate the knight walked through.
  const gate = posts.cleared.at(-1)?.place;
  const through =
    posts.enteredWard &&
    `Through ${gate ? gate.replace(/^The /, 'the ') : 'the gate'}: the ${posts.enteredWard}.`;
  const next = posts.next;
  const announcement = [
    title,
    story,
    rank && `New rank. ${rank.name}.`,
    through,
    next && `Next, ${next.place}: ${next.topic}.`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <BeatFrame
      announcement={announcement}
      readyAfter={AT.ready}
      primary={primary}
    >
      <View style={styles.centered}>
        <View>
          <PopIn bounce>
            {rank ? (
              <SpriteView sprite={emblem} size={96} />
            ) : (
              <View style={styles.badge}>
                <Check size={48} color={theme.colors.onBrand} />
              </View>
            )}
          </PopIn>
          <Sparkles
            fire={landed}
            color={rank ? theme.colors.gold : theme.colors.brand}
            reach={80}
          />
        </View>
        <FadeIn delay={AT.title}>
          <View style={styles.centered}>
            {held.length > 0 && (
              <Text style={styles.eyebrow}>
                {held.length === 1
                  ? `Post ${first?.index} cleared`
                  : `${held.length} posts cleared`}
              </Text>
            )}
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {story && <Text style={styles.coach}>{story}</Text>}
          </View>
        </FadeIn>
        {rank && (
          <FadeIn delay={AT.rank}>
            <View style={styles.centered}>
              <Text style={[styles.eyebrow, styles.gold]}>New rank</Text>
              <Text style={styles.rank}>{rank.name}</Text>
            </View>
          </FadeIn>
        )}
      </View>
      {next && (
        <FadeIn delay={AT.next}>
          <View style={styles.next}>
            {through && <Text style={styles.ward}>{through}</Text>}
            <Text style={styles.eyebrow}>{`Next · Post ${next.index}`}</Text>
            <Text style={styles.nextPlace}>{next.place}</Text>
            <Text style={styles.coach}>{next.topic}</Text>
            {next.line && <Text style={styles.line}>{`“${next.line}”`}</Text>}
          </View>
        </FadeIn>
      )}
    </BeatFrame>
  );
}

const useStyles = createStyles((theme) => ({
  centered: { alignItems: 'center', gap: theme.spacing.sm },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand,
    borderBottomWidth: 5,
    borderColor: theme.colors.brandLedge,
  },
  eyebrow: {
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  gold: { color: theme.colors.goldText },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  rank: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  coach: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  next: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  ward: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    textAlign: 'center',
  },
  nextPlace: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  line: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontStyle: 'italic',
    fontSize: theme.typography.size.body,
    lineHeight: 22,
    textAlign: 'center',
  },
}));
