import { Switch, Text, View } from 'react-native';
import type { JourneyMap, KeptNight } from '../../lib/api/journey-contract';
import type { DailyReview } from '../../lib/api/today-contract';
import { deckGrowth } from '../../lib/deck-growth';
import { createStyles, useTheme } from '../../theme/theme';
import { Button, Card, SpriteView, useRankEmblem } from '../../ui';
import { EXTRA_WATCH_HREF } from '../practice/practice-api';
import type { MapCastle } from './journey-map';
import { comingUp, type PathModel, type PathNode, postKey } from './path-model';
import { AheadCard, ExtraKeptCard, KeptNightCard } from './path-node-cards';
import { castleText } from './path-view';
import {
  dailyProgress,
  inARow,
  type TodayState,
  tonightNight,
} from './today-state';
import { keptLines, type TonightOutcome, type TonightRow } from './tonight';
import { TonightCard, TonightResults } from './tonight-card';
import { ComingUp, PostCard } from './ward-cards';
import { WatchHero } from './watch-hero';
import { anchorSentence } from './watch-model';

// The node card (docs/specs/2026-10-19-path-home-design.md, "The node card"):
// what a tapped node holds, shown by the node screen as the platform's own
// sheet over the path (TodayNodeScreen). Tonight's card is the watch card that was the Watch page's;
// tomorrow's is the Tomorrow night card with its reminder switch.

export type TodayActions = {
  open: (href: string) => void;
  connectGames: () => void;
  retry: () => void;
};

/** Done's "Learn more" (Anki's Custom Study): more new positions for today only. */
export type TodayLearnMore = {
  onPress: () => void;
  busy: boolean;
  /** The last attempt failed. */
  error?: string;
};

/** Tomorrow's reminder switch (native only; absent on web and in samples without it). */
export type TodayReminder = {
  enabled: boolean;
  /** The chosen time, already formatted ("8:00 PM"). */
  time: string;
  disabled: boolean;
  /** Permission was refused: only system settings can allow notifications. */
  blocked: boolean;
  onToggle: (enabled: boolean) => void;
  onOpenSystemSettings: () => void;
};

/** What the home shows of tonight: up to three of the lesson's moves by name
 * (`today.tonight`), and tonight's answers. */
export type Tonight = TonightOutcome & { rows: readonly TonightRow[] };

const noAnswers: TonightOutcome = {
  held: 0,
  slipped: 0,
  back: null,
  stoppedLabels: [],
};

/** A kept night's moves as the node screen loaded them. */
export type KeptNightResource = { data?: KeptNight; failed?: boolean };

export type OpenCard =
  | { kind: 'node'; node: PathNode }
  | { kind: 'castle'; castle: MapCastle };

/** The node screen's address for a node or a castle on the path. */
export const nodeHref = (key: string) => `/node?key=${encodeURIComponent(key)}`;
export const castleHref = (key: string) =>
  `/node?castle=${encodeURIComponent(key)}`;

/** Which card a node screen address names, found on the path as it is now
 * (null when the path no longer has it). */
export function findCard(
  model: PathModel,
  { key, castle }: { key?: string; castle?: string },
): OpenCard | null {
  if (castle) {
    const found = [
      ...model.nodes.flatMap((node) => node.castles),
      ...model.later,
    ].find((c) => c.key === castle);
    return found ? { kind: 'castle', castle: found } : null;
  }
  const node = model.nodes.find((n) => n.key === key);
  if (node) return { kind: 'node', node };
  // The current post has no marker (its lessons are drawn instead); the
  // banner's About button opens its card by the same address.
  const post = model.current?.post;
  return post && key === postKey(post.key)
    ? {
        kind: 'node',
        node: {
          key: postKey(post.key),
          kind: 'post',
          state: 'current',
          night: null,
          title: post.place,
          detail: post.topic,
          stars: [],
          castles: [],
          post,
        },
      }
    : null;
}

function ReminderToggle({ reminder }: { reminder: TodayReminder }) {
  const styles = useStyles();
  const { theme } = useTheme();
  const label = `Remind me at ${reminder.time}`;
  return (
    <>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.quiet}>
            Only on days you haven’t kept your watch. Change it in Settings.
          </Text>
        </View>
        <Switch
          accessibilityLabel={label}
          value={reminder.enabled}
          disabled={reminder.disabled}
          onValueChange={reminder.onToggle}
          trackColor={{ true: theme.colors.brand }}
        />
      </View>
      {reminder.blocked && (
        <View style={styles.notificationsOff}>
          <Text style={styles.quiet}>Notifications are off for Knightly.</Text>
          <Button variant="text" onPress={reminder.onOpenSystemSettings}>
            Open Settings
          </Button>
        </View>
      )}
    </>
  );
}

const growthOf = (review: DailyReview) =>
  deckGrowth(
    review.memory.total,
    review.games,
    review.plan.some((step) => step.kind === 'puzzles'),
  );
/** Rest's note: why the deck is empty when it is, else the streak rule. */
function restNote(review: DailyReview) {
  const growth = growthOf(review);
  return growth.kind === 'analyzing' || growth.kind === 'clean'
    ? growth.text
    : 'Your streak is safe on days with nothing to review.';
}

/** What the rest of the daily plan holds, in a few words. */
function extraPractice(review: DailyReview) {
  const parts = dailyProgress(review).steps.flatMap((step) => {
    if (step.done) return [];
    if (step.kind === 'game') return ['your latest game'];
    const left = step.total - step.count;
    const noun = step.kind === 'positions' ? 'position' : 'puzzle';
    return left > 0 ? [`${left} ${noun}${left === 1 ? '' : 's'}`] : [];
  });
  if (parts.length === 0) return 'the rest of today’s practice';
  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** Tomorrow night: the anchor, the moves due and the reminder switch. */
function TomorrowCard({
  night,
  review,
  kept,
  reminder,
  onOpen,
}: {
  /** Tomorrow's night, all time. */
  night: number | null;
  review: DailyReview;
  kept: boolean;
  reminder?: TodayReminder;
  onOpen: (href: string) => void;
}) {
  const styles = useStyles();
  const due = review.tomorrow_due;
  return (
    <Card eyebrow="Tomorrow night">
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.title}>
          {night ? `Night ${night} is waiting` : 'Tomorrow’s watch is waiting'}
        </Text>
        <Text style={styles.quiet}>
          {due
            ? `${due} ${due === 1 ? 'move' : 'moves'} due${review.new_games ? ', plus your next game' : ''}`
            : 'Nothing due yet. Play a game and it joins your watch.'}
        </Text>
      </View>
      {review.watch ? (
        <Text style={styles.quiet}>{anchorSentence(review.watch.anchor)}</Text>
      ) : (
        // No watch yet: once tonight is kept, the quiet way to choose one.
        kept &&
        review.watch === null && (
          <Button variant="text" onPress={() => onOpen('/watch')}>
            Choose a time for tomorrow
          </Button>
        )
      )}
      {reminder && <ReminderToggle reminder={reminder} />}
    </Card>
  );
}

/** The extra watch: the same kind of watch, offered and never pushed. */
function ExtraCard({
  state,
  learnMore,
  onOpen,
}: {
  state: Extract<TodayState, { kind: 'done' }>;
  learnMore?: TodayLearnMore;
  onOpen: (href: string) => void;
}) {
  const styles = useStyles();
  const { review } = state;
  const progress = dailyProgress(review);
  // Until the server builds extra watches, an extra watch is the rest of
  // today's practice from the wall; once that is finished, new positions for
  // today (Learn more), when there are any.
  const start = progress.next
    ? () => onOpen(EXTRA_WATCH_HREF)
    : learnMore && review.learn_more > 0 && !learnMore.busy
      ? learnMore.onPress
      : undefined;
  return (
    <Card
      eyebrow={
        progress.next
          ? `Extra watch · about ${progress.minutes} min`
          : 'Extra watch'
      }
      eyebrowTone="muted"
    >
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.title}>
          {start ? 'Another watch from the wall' : 'Nothing more tonight'}
        </Text>
        <Text style={styles.quiet}>
          {start
            ? `Optional · ${progress.next ? extraPractice(review) : 'new positions for today'}`
            : 'Tonight is kept. You can stop here.'}
        </Text>
      </View>
      {learnMore?.error && (
        <Text
          style={styles.danger}
        >{`Couldn’t add positions. ${learnMore.error}`}</Text>
      )}
      {start && (
        <Button variant="secondary" onPress={start}>
          Start
        </Button>
      )}
    </Card>
  );
}

/** A castle: its rank, emblem, and the stars needed or the day reached. */
function CastleCard({ castle }: { castle: MapCastle }) {
  const styles = useStyles();
  const emblem = useRankEmblem({ key: castle.key, name: castle.name });
  return (
    <Card>
      <View style={styles.row}>
        <SpriteView sprite={emblem} size={56} />
        <View style={styles.rowText}>
          <Text accessibilityRole="header" style={styles.headline}>
            {castle.name}
          </Text>
          <Text style={styles.quiet}>
            {castle.key === 'page' && castle.state !== 'reached'
              ? 'Reached with your first watch'
              : castleText(castle)}
          </Text>
        </View>
      </View>
      {(castle.after !== undefined || castle.beyond) &&
        castle.state !== 'reached' && (
          <Text style={styles.quiet}>
            {castle.beyond
              ? 'It stands beyond the posts built so far.'
              : `It stands after post ${castle.after}. Hold every post before it to reach it.`}
          </Text>
        )}
    </Card>
  );
}

/** The card for the open node or castle. */
export function NodeCard({
  open,
  state,
  tonight,
  reminder,
  learnMore,
  keptNight,
  journey,
  actions,
}: {
  open: OpenCard;
  state: TodayState;
  tonight?: Tonight;
  reminder?: TodayReminder;
  learnMore?: TodayLearnMore;
  /** A kept night's moves (`/api/journey/night`), for its card. */
  keptNight?: KeptNightResource;
  /** `/api/journey`, for what comes back when on the ward path's cards. */
  journey?: JourneyMap;
  actions: TodayActions;
}) {
  const styles = useStyles();
  if (open.kind === 'castle') return <CastleCard castle={open.castle} />;
  const { node } = open;
  const review = 'review' in state ? state.review : undefined;
  const night = review
    ? review.streak.count + (review.streak.safe_today ? 0 : 1)
    : 0;
  // On the ward path the nights are not nodes: tonight's and the extra
  // watch's cards carry tomorrow and what comes back when.
  const ahead =
    node.lesson && review
      ? comingUp(review.tomorrow_due, journey?.ahead)
      : null;
  switch (node.kind) {
    case 'tonight': {
      if (
        state.kind === 'ready' ||
        state.kind === 'returning' ||
        state.kind === 'at-risk'
      )
        return (
          <View style={styles.stack}>
            <View style={styles.bleed}>
              <WatchHero
                wall="before"
                night={night}
                radius={0}
                clearTopRight
                post={node.post?.key}
                progress={
                  state.kind === 'returning' && state.start.kind === 'lesson'
                    ? state.start
                    : undefined
                }
              />
            </View>
            <TonightCard
              state={state}
              rows={tonight?.rows ?? []}
              onOpen={actions.open}
              at={
                node.post && node.lesson
                  ? { place: node.post.place, lesson: node.lesson.name }
                  : undefined
              }
            />
            {ahead && <ComingUp rows={ahead} />}
          </View>
        );
      if (state.kind === 'done') {
        const lines = keptLines(
          tonight ?? noAnswers,
          state.review.memory.stopped_today ?? 0,
        );
        return (
          <View style={styles.stack}>
            <View style={styles.bleed}>
              <WatchHero
                wall="kept"
                night={night}
                radius={0}
                clearTopRight
                relit={!!state.review.memory.stopped_today}
              />
            </View>
            <View style={styles.text}>
              <Text accessibilityRole="header" style={styles.headline}>
                {`Night ${node.night ?? tonightNight(state.review.streak)} kept`}
              </Text>
              <Text style={styles.quiet}>
                {`${inARow(state.review.streak.count)} · Good night, knight. You can stop here.`}
              </Text>
            </View>
            <TonightResults lines={lines} />
          </View>
        );
      }
      if (state.kind === 'rest')
        return (
          <Card
            title={
              growthOf(state.review).kind === 'analyzing'
                ? 'Your watch is on its way'
                : 'Nothing to watch tonight'
            }
            description={restNote(state.review)}
          >
            <Button variant="secondary" onPress={() => actions.open('/games')}>
              Browse your games
            </Button>
          </Card>
        );
      return null;
    }
    case 'extra':
      if (state.kind !== 'done') return null;
      if (!node.lesson || !ahead)
        return (
          <ExtraCard
            state={state}
            learnMore={learnMore}
            onOpen={actions.open}
          />
        );
      // The ward path's extra watch also holds tomorrow (its reminder and the
      // watch time) and the nights after it.
      return (
        <View style={styles.stack}>
          <ExtraCard
            state={state}
            learnMore={learnMore}
            onOpen={actions.open}
          />
          <TomorrowCard
            night={tonightNight(state.review.streak) + 1}
            review={state.review}
            kept
            reminder={reminder}
            onOpen={actions.open}
          />
          <ComingUp rows={ahead.slice(1)} />
        </View>
      );
    case 'tomorrow':
      return review ? (
        <TomorrowCard
          night={node.night}
          review={review}
          kept={state.kind === 'done'}
          reminder={reminder}
          onOpen={actions.open}
        />
      ) : null;
    case 'post':
    case 'locked':
      return node.post ? (
        <View style={styles.stack}>
          <View style={styles.bleed}>
            <WatchHero
              wall="before"
              night={night}
              radius={0}
              clearTopRight
              post={node.post.key}
            />
          </View>
          <PostCard post={node.post} />
        </View>
      ) : null;
    case 'kept':
      return (
        <KeptNightCard
          node={node}
          night={keptNight?.data}
          failed={keptNight?.failed}
          today={review?.day ?? node.date ?? ''}
        />
      );
    case 'extraKept':
      return <ExtraKeptCard node={node} />;
    case 'ahead':
      return node.ahead ? <AheadCard node={node} day={node.ahead} /> : null;
    case 'connect':
      return (
        <Card title="Connect your games" description={node.detail ?? undefined}>
          {node.state === 'current' && (
            <Button onPress={actions.connectGames}>Connect your games</Button>
          )}
        </Card>
      );
    case 'finding':
      return (
        <Card title={node.title} description={node.detail ?? undefined}>
          <Text style={styles.quiet}>
            Moves got past you in your games. They’ll try again. I’ll find them,
            and we’ll keep watch on the wall until they stop.
          </Text>
          {node.state === 'current' && (
            <Button
              variant="secondary"
              onPress={() => actions.open('/practice?mode=lesson')}
            >
              Try a puzzle while you wait
            </Button>
          )}
        </Card>
      );
    case 'firstWatch':
      return state.kind === 'first' ? (
        <View style={styles.stack}>
          <View style={styles.bleed}>
            <WatchHero wall="firstNight" night={1} radius={0} clearTopRight />
          </View>
          <Card
            eyebrow={`Your first watch · about ${state.minutes} min`}
            title="Every night, a short watch."
            description="The moves that slipped past you will try again. Spot them first."
          >
            <Button onPress={() => actions.open(state.start.href)}>
              Start first watch
            </Button>
          </Card>
        </View>
      ) : (
        <Card
          title="Your first watch"
          description="It lights once the moves that slipped past you are found."
        />
      );
    default:
      return null;
  }
}

const useStyles = createStyles((theme) => ({
  // Edge to edge to the sheet's top: a card's hero bleeds out of the
  // sheet body's padding (NodeView).
  bleed: {
    marginTop: -theme.spacing.md,
    marginHorizontal: -theme.spacing.md,
  },
  stack: { gap: theme.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: theme.layout.minControl,
  },
  text: { gap: 2 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  headline: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 24,
    lineHeight: 30,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 20,
  },
  danger: {
    color: theme.colors.dangerText,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 20,
  },
  notificationsOff: { alignItems: 'flex-start' },
}));
