import { Text, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { Button, Card, PositionThumbnail } from '../../ui';
import { reminderTimeLabel } from './reminder-schedule';
import type { TodayState } from './today-state';
import {
  type keptLines,
  moreTonight,
  type TonightChip,
  type TonightRow,
  tonightGame,
  tonightHeadline,
} from './tonight';

type BeforeState = Extract<
  TodayState,
  { kind: 'ready' | 'returning' | 'at-risk' }
>;

/** The move rows the card shows at most. */
const ROWS = 3;

function Chip({ chip }: { chip: TonightChip }) {
  const styles = useStyles();
  const held = chip === 'Almost held' || chip === 'Last check';
  return (
    <View style={[styles.chip, held && styles.chipHeld]}>
      <Text style={styles.chipText}>{chip}</Text>
    </View>
  );
}

/** A move that slipped past: its position, label, game and chip. */
export function MoveRow({ row }: { row: TonightRow }) {
  const styles = useStyles();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[row.label, row.detail, row.chip]
        .filter(Boolean)
        .join('. ')}
    >
      <PositionThumbnail fen={row.fen} from={row.color} size={44} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{row.label}</Text>
        {!!row.detail && <Text style={styles.quiet}>{row.detail}</Text>}
      </View>
      {row.chip && <Chip chip={row.chip} />}
    </View>
  );
}

/**
 * Tonight's watch before it is kept: how long it takes, the moves that
 * slipped past (up to three, by name), the one button
 * and the learner's anchor. A newly analysed game's slips lead it as that
 * game's card, with a link to replay the whole game (the game review folded
 * into the watch). With no lesson, the game review is the watch.
 */
export function TonightCard({
  state,
  rows,
  onOpen,
  at,
  now = new Date(),
}: {
  state: BeforeState;
  rows: readonly TonightRow[];
  onOpen: (href: string) => void;
  /** On the ward path: the post tonight's new material comes from and its
   * lesson, which name the eyebrow ("Tonight at the Lists"). */
  at?: { place: string; lesson: string };
  /** The clock for when the leading game was played. */
  now?: Date;
}) {
  const styles = useStyles();
  const { review, start } = state;
  const lesson = start.kind === 'lesson';
  const atRisk = state.kind === 'at-risk';
  const shown = lesson ? rows.slice(0, ROWS) : [];
  const more = lesson ? moreTonight(review, shown.length) : 0;
  const game = lesson ? tonightGame(review, now) : null;
  const head = game
    ? game
    : lesson
      ? tonightHeadline(review, shown)
      : {
          title: 'Review your game',
          coach: review.game?.opponent
            ? `Your newest analysed game, vs ${review.game.opponent}. Find what slipped past you.`
            : 'Your newest analysed game. Find what slipped past you.',
        };
  const eyebrow = atRisk
    ? state.hoursLeft < 1
      ? 'Less than an hour left tonight'
      : `${Math.round(state.hoursLeft)} hours left tonight`
    : state.kind === 'returning' && lesson
      ? `Tonight’s watch · ${start.done} of ${start.total} · about ${state.minutes} min`
      : `Tonight’s watch · about ${state.minutes} min`;
  // One eyebrow, never two: on the ward path the post names the watch.
  const named = at
    ? eyebrow.replace(
        'Tonight’s watch',
        `Tonight at ${at.place.replace(/^The /, 'the ')}`,
      )
    : eyebrow;
  const label = !lesson
    ? 'Review your game'
    : atRisk
      ? 'Save my streak'
      : state.kind === 'returning'
        ? 'Continue watch'
        : 'Start watch';
  const watch = review.watch;
  return (
    <Card eyebrow={named} eyebrowTone={atRisk ? 'gold' : undefined}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.headline}>
          {head.title}
        </Text>
        <Text style={styles.coach}>{head.coach}</Text>
        {at && lesson && (
          <Text style={styles.quiet}>{`New tonight: ${at.lesson}`}</Text>
        )}
      </View>
      {(shown.length > 0 || more > 0) && (
        <View style={styles.rows}>
          {shown.map((row) => (
            <MoveRow key={`${row.gameId}:${row.ply}`} row={row} />
          ))}
          {more > 0 && (
            <Text style={[styles.quiet, shown.length > 0 && styles.moreIndent]}>
              {game
                ? `+ ${more} ${more === 1 ? 'move' : 'moves'} you’re keeping hold of`
                : `+ ${more} more you’re keeping hold of`}
            </Text>
          )}
        </View>
      )}
      <Button
        variant={atRisk ? 'gold' : 'primary'}
        onPress={() => onOpen(start.href)}
      >
        {label}
      </Button>
      {game && (
        <Button variant="text" onPress={() => onOpen(game.replayHref)}>
          Replay the whole game
        </Button>
      )}
      {watch && (
        <Text style={[styles.quiet, styles.center]}>
          {`After I ${watch.anchor} · ${reminderTimeLabel(watch.time)}`}
        </Text>
      )}
    </Card>
  );
}

/** How tonight's watch went: moves held, moves that slipped past again (and
 * when they are back), and any that stopped slipping (their stars relit, and
 * the stars still needed for the next rank). Nothing until something was
 * answered tonight. */
export function TonightResults({
  lines,
}: {
  lines: ReturnType<typeof keptLines>;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const { held, slipped, stopped } = lines;
  if (!held && !slipped && !stopped) return null;
  return (
    <Card eyebrow="Tonight’s watch">
      {held && (
        <View style={styles.row}>
          <View style={[styles.mark, { backgroundColor: theme.colors.brand }]}>
            <Text style={[styles.markText, { color: theme.colors.onBrand }]}>
              ✓
            </Text>
          </View>
          <Text style={[styles.rowTitle, styles.rowText]}>{held}</Text>
        </View>
      )}
      {slipped && (
        <View style={styles.row}>
          <View style={[styles.mark, styles.again]}>
            <Text style={styles.markText}>↺</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{slipped.title}</Text>
            <Text style={styles.quiet}>{slipped.detail}</Text>
          </View>
        </View>
      )}
      {stopped && (
        <View style={styles.row}>
          <View style={[styles.mark, { backgroundColor: theme.colors.gold }]}>
            <Text style={styles.markText}>★</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{stopped.title}</Text>
            <Text style={styles.quiet}>{stopped.detail}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

const useStyles = createStyles((theme) => ({
  head: { gap: theme.spacing.xs },
  headline: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 24,
    lineHeight: 30,
  },
  coach: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: 22,
  },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 20,
  },
  moreIndent: { paddingLeft: 56 },
  center: { textAlign: 'center' },
  chip: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: `${theme.colors.sky}29`,
  },
  chipHeld: { backgroundColor: `${theme.colors.brand}29` },
  chipText: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  again: { borderWidth: 2, borderColor: theme.colors.sky },
  markText: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 14,
  },
}));
