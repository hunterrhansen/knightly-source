import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import type { JourneyMap } from '../../lib/api/journey-contract';
import type { DailyReview } from '../../lib/api/today-contract';
import { createStyles, useTheme } from '../../theme/theme';
import {
  Avatar,
  IconButton,
  NavigationHeader,
  Notice,
  Screen,
  SpriteView,
  usePressSquish,
  useRankEmblem,
  watchColors,
} from '../../ui';
import { HomeTiles } from './home-tiles';
import { journeyRank } from './journey-map';
import {
  castleHref,
  nodeHref,
  type TodayActions,
  type Tonight,
} from './node-card';
import { type PathModel, pathModel, postKey } from './path-model';
import { PathView } from './path-view';
import { inARow, type TodayState, tonightNight } from './today-state';
import { StreakButton } from './today-streak-badge';
import { watchTitle } from './tonight';
import { TrackGlyph } from './track-glyph';
import type { PathPost } from './ward-path';
import { wardPathLayout } from './ward-path';

export type { TodayActions, Tonight };

/** The rank chip: the rank and its stars ("Squire II · ★ 23"); opens
 * Progress. */
function RankChip({
  rank,
  stars,
  post,
  onPress,
}: {
  rank: { key?: string; name: string };
  stars: number;
  /** On the ward path, the current post's number ("Squire I · Post 4"). */
  post?: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  const emblem = useRankEmblem(rank);
  const squish = usePressSquish();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank.name}, ${post ? `post ${post}` : `${stars} ${stars === 1 ? 'star' : 'stars'}`}. Opens Progress`}
      onPress={onPress}
      onPressIn={squish.onPressIn}
      onPressOut={squish.onPressOut}
      hitSlop={4}
    >
      <Animated.View style={[styles.chip, squish.style]}>
        <SpriteView sprite={emblem} size={26} />
        <Text style={styles.chipText}>
          {post ? `${rank.name} · Post ${post}` : `${rank.name} · ★ ${stars}`}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** The section banner, pinned over the path, two short lines as Duolingo's:
 * the section and rank as its eyebrow, the stars to the next as its title.
 * What the lesson leans toward lately is read out, not drawn, to keep the
 * path in view. */
function SectionBanner({
  section,
  post,
  onAbout,
}: {
  section: NonNullable<PathModel['section']>;
  /** On the ward path, the current post: its About button opens its card. */
  post?: PathPost;
  onAbout?: () => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  return (
    <View style={[styles.banner, styles.bannerRow]}>
      <View
        style={styles.bannerText}
        accessible
        accessibilityRole="header"
        accessibilityLabel={
          section.topic
            ? `${section.title}. ${section.goal}: ${section.topic}. ${section.subtitle}`
            : `${section.title}. ${section.goal}. ${section.subtitle}`
        }
      >
        <Text style={styles.bannerEyebrow} numberOfLines={1}>
          {section.title}
        </Text>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          {section.goal}
        </Text>
        {/* On the ward path the place leads and the plain topic is drawn under
          it, never left for the learner to decode. */}
        {section.topic && (
          <Text style={styles.bannerTopic} numberOfLines={2}>
            {section.topic}
          </Text>
        )}
      </View>
      {post && onAbout && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`About ${post.place}`}
          onPress={onAbout}
          style={({ pressed }) => [styles.about, pressed && styles.aboutDown]}
        >
          <TrackGlyph
            track={post.lessons[0]?.track ?? 'tactic'}
            size={20}
            color={theme.colors.ink}
          />
        </Pressable>
      )}
    </View>
  );
}

/** Tonight kept: a quiet line the learner can put away. */
function KeptNote({
  night,
  run,
  onDismiss,
}: {
  /** Tonight's night, all time. */
  night: number;
  /** Nights in a row, tonight included. */
  run: number;
  onDismiss: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.kept} accessibilityLiveRegion="polite">
      <View style={styles.keptText}>
        <Text style={styles.keptTitle}>
          {`Night ${night} kept · ${inARow(run)}`}
        </Text>
        <Text style={styles.quiet}>Good night, knight. You can stop here.</Text>
      </View>
      <IconButton
        icon="close"
        tone="muted"
        compact
        iconSize={18}
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
      />
    </View>
  );
}

/** The rank the top bar shows: the journey's when loaded, else `/api/home`'s. */
function rankOf(review?: DailyReview, journey?: JourneyMap) {
  if (journey) {
    const { rank, stars } = journeyRank(journey);
    // On the ward path the rank is the higher of the stars' and the posts'.
    const layout = wardPathLayout(journey);
    return layout
      ? { rank: layout.rank, stars, post: layout.current.index }
      : { rank, stars };
  }
  return review?.journey
    ? { rank: { name: review.journey.rank }, stars: review.journey.stars }
    : null;
}

/**
 * The one screen (docs/specs/2026-10-19-path-home-design.md, "Home: the
 * path" and "One screen, no tab bar"): the learner's review schedule as a
 * road. The top bar (streak, rank chip, avatar), the section banner, the
 * Games and Progress tiles on the path's left edge, then the path, opened on
 * tonight's node. Tapping a node opens its card as the node screen, the
 * platform's own sheet over the path; tonight's starts the watch.
 */
export function TodayScreen({
  state,
  actions,
  journey,
  now = new Date(),
  notice,
  accountName = 'Your account',
  focused = true,
}: {
  state: TodayState;
  actions: TodayActions;
  /** `/api/journey`: the nights kept, stars and castles. Without it the path
   * still has tonight and tomorrow. */
  journey?: JourneyMap;
  /** The clock for the title. */
  now?: Date;
  /** A one-off message above the path, e.g. after an unavailable link. */
  notice?: string;
  /** The web's avatar (natively the header draws it). */
  accountName?: string;
  /** Whether home is on screen (a step along the path waits for it). */
  focused?: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  // On a wide window the path keeps one centred column (the sky stays
  // full-bleed): the side tiles sit at the column's edge, not the window's.
  const { width } = useWindowDimensions();
  const gutter = Math.max(0, (width - theme.layout.pathMax) / 2);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const model = useMemo(() => pathModel(state, journey), [state, journey]);
  const review = 'review' in state ? state.review : undefined;
  const rank = rankOf(review, journey);
  const keptToday = state.kind === 'done' && dismissed !== state.review.day;
  // The path fills the screen; the header, banner and side tiles float over it.
  const header = useContext(HeaderHeightContext) ?? 0;
  const [overlay, setOverlay] = useState(0);
  // The banner's top within the column: the path is hidden above it, so
  // nothing scrolling up under the banner shows again above it.
  const [bannerAt, setBannerAt] = useState<number | null>(null);
  const coverTop =
    model.section && bannerAt !== null
      ? header + theme.spacing.sm + bannerAt
      : 0;
  // iOS already insets the scroll below the native header.
  const insetTop = Math.max(0, overlay - (Platform.OS === 'ios' ? header : 0));
  return (
    <Screen preset="fixed">
      {Platform.OS !== 'web' && (
        <NavigationHeader
          title={watchTitle(now)}
          transparent
          // The design's top bar: streak, rank chip, avatar, no title.
          titleView={
            rank
              ? () => (
                  <RankChip
                    rank={rank.rank}
                    stars={rank.stars}
                    post={'post' in rank ? rank.post : undefined}
                    onPress={() => actions.open('/progress')}
                  />
                )
              : undefined
          }
        />
      )}
      {model.nodes.length > 0 && (
        <View style={styles.path}>
          <PathView
            model={model}
            insetTop={insetTop}
            coverTop={coverTop}
            focused={focused}
            onNode={(node) => actions.open(nodeHref(node.key))}
            onCastle={(castle) => actions.open(castleHref(castle.key))}
          />
        </View>
      )}
      {model.nodes.length > 0 && (
        <View style={styles.tiles(overlay, gutter)}>
          <HomeTiles
            newGames={review?.new_games_slipped ?? 0}
            onGames={() => actions.open('/games')}
            onProgress={() => actions.open('/progress')}
          />
        </View>
      )}
      <View
        style={styles.top(header)}
        onLayout={(event) => setOverlay(event.nativeEvent.layout.height)}
      >
        <View style={styles.column}>
          {/* Natively the streak, rank chip and avatar are the header. */}
          {Platform.OS === 'web' && (
            <View style={styles.bar}>
              {review && <StreakButton streak={review.streak} />}
              {rank && (
                <RankChip
                  rank={rank.rank}
                  stars={rank.stars}
                  post={'post' in rank ? rank.post : undefined}
                  onPress={() => actions.open('/progress')}
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Account & settings"
                onPress={() => actions.open('/account')}
                style={styles.avatar}
              >
                {({ pressed }) => (
                  <Avatar name={accountName} pressed={pressed} />
                )}
              </Pressable>
            </View>
          )}
          {notice && <Notice title={notice} />}
          {state.kind === 'loading' && (
            <Notice title="Loading tonight’s watch…" />
          )}
          {state.kind === 'error' && (
            <Notice
              title="Tonight’s watch is unavailable"
              message={state.message}
              action="Retry"
              onAction={actions.retry}
            />
          )}
          {model.section && (
            <View onLayout={(event) => setBannerAt(event.nativeEvent.layout.y)}>
              <SectionBanner
                section={model.section}
                post={model.current?.post}
                onAbout={() => {
                  const post = model.current?.post;
                  if (post) actions.open(nodeHref(postKey(post.key)));
                }}
              />
            </View>
          )}
          {keptToday && (
            <KeptNote
              night={
                model.nodes.find((node) => node.kind === 'tonight')?.night ??
                tonightNight(state.review.streak)
              }
              run={state.review.streak.count}
              onDismiss={() => setDismissed(state.review.day)}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  // The path behind everything, edge to edge.
  path: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // Floats over the path's top; taps between its pieces reach the path.
  top: (header: number) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none' as const,
    gap: theme.spacing.sm,
    paddingTop: header + theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    alignItems: 'center' as const,
  }),
  // The top bar, banner and notes share the path's column.
  column: {
    width: '100%',
    maxWidth: theme.layout.pathMax - 2 * theme.spacing.md,
    gap: theme.spacing.sm,
    pointerEvents: 'box-none',
  },
  // The side tiles float on the path's left edge, under the top bar; the
  // path scrolls beneath them and never moves for them.
  tiles: (top: number, gutter: number) => ({
    position: 'absolute' as const,
    top: top + theme.spacing.xs,
    left: gutter + theme.spacing.md,
  }),
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingLeft: 6,
    paddingRight: 12,
    marginLeft: 'auto',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  chipText: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    fontVariant: ['tabular-nums'],
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  bannerText: { flex: 1, gap: 2 },
  // The post's guide, as Duolingo's unit guidebook button.
  about: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: watchColors.bannerEdge,
    borderBottomWidth: 3,
    borderColor: watchColors.bannerLedge,
  },
  aboutDown: { borderBottomWidth: 0, marginTop: 3 },
  banner: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: watchColors.bannerEdge,
    borderBottomColor: watchColors.bannerLedge,
    borderBottomWidth: 4,
    backgroundColor: watchColors.banner,
  },
  bannerEyebrow: {
    color: watchColors.bannerEyebrow,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.eyebrow,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bannerTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 18,
    lineHeight: 24,
  },
  bannerTopic: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 20,
  },
  kept: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  keptText: { flex: 1, minWidth: 0, gap: 2, paddingVertical: theme.spacing.sm },
  keptTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 16,
    lineHeight: 22,
  },
}));
