import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BoardProps } from '../../chess/board';
import type { GameDetail } from '../../lib/api/review-contract';
import { createStyles } from '../../theme/theme';
import {
  Button,
  CoachBubble,
  LessonFrame,
  LessonHeader,
  SkeletonLine,
  useLoadingCoach,
} from '../../ui';
import { SlipChip } from '../games/games-api';
import { MoveTally } from './move-tally';
import { firstOfKind, tally } from './review-moments';
import { localDay, type SlipRow, slipRows } from './review-slips';
import { WinGraph } from './win-graph';

const fixed = (n: number | null | undefined) =>
  n === null || n === undefined ? '–' : n.toFixed(1);

/** A slipped move: its label and reason, the four-segment track from on
 * watch to stopped slipping, and when it comes back. */
function SlipRowView({ row }: { row: SlipRow }) {
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={[row.title, row.reason, row.progress, row.chip]
        .filter(Boolean)
        .join(', ')}
      style={styles.slipRow}
    >
      <View style={styles.slipText}>
        <Text style={styles.slipTitle}>{row.title}</Text>
        {row.reason && <Text style={styles.slipReason}>{row.reason}</Text>}
        <View style={styles.track}>
          {[1, 2, 3, 4].map((segment) => (
            <View
              key={segment}
              style={[
                styles.segment,
                segment <= row.lit && styles.segmentLit(row.tone),
              ]}
            />
          ))}
        </View>
      </View>
      <SlipChip tone={row.tone} label={row.chip} />
    </View>
  );
}

/** The game at a glance before the review: win chance, accuracy and every
 * kind of move both players made, then what slipped past you and where each
 * of those moves is on the watch. */
export function ReviewSummary({
  game,
  moments,
  onExit,
  onStart,
  onMoves,
  reviewed,
  onKeepWatch,
  today = localDay(new Date()),
  side,
}: {
  game: GameDetail;
  moments: number;
  onExit: () => void;
  onStart: () => void;
  onMoves: (index?: number) => void;
  reviewed: boolean;
  /** Opens tonight's watch; absent once it's kept (or outside the app's watch). */
  onKeepWatch?: () => void;
  /** The local day (YYYY-MM-DD) due days are read against. */
  today?: string;
  /** Wide screens, as Chess.com's: the summary in the side panel beside the
   * board at the starting position, so starting the review never moves it. */
  side?: {
    board: BoardProps;
    bands: { above: ReactNode; under: ReactNode; bandHeight: number };
    /** The eval bar, as the lesson has it, so the board holds still. */
    beside?: ReactNode;
  };
}) {
  const styles = useStyles();
  const slips = slipRows(game, today);
  const insets = useSafeAreaInsets();
  const black = game.color === 'black';
  const you = 'You';
  const them = black ? game.white : game.black;
  const yourElo = black ? game.black_elo : game.white_elo;
  const theirElo = black ? game.white_elo : game.black_elo;
  const yourAccuracy = game.engine_accuracy ?? game.accuracy;
  const counts = Object.fromEntries(tally(game).map((r) => [r.kind, r.you]));
  const coach =
    (counts.brilliant ?? 0) + (counts.great ?? 0) > 0
      ? 'Some strong moves here!'
      : (counts.blunder ?? 0) + (counts.mistake ?? 0) > 0
        ? 'A few moments turned this game.'
        : 'A clean game.';
  const header = (
    <LessonHeader
      title="Game review"
      onClose={onExit}
      onList={() => onMoves(0)}
    />
  );
  const bubble = (
    <CoachBubble
      title={coach}
      body={`${moments} key moments to step through, plus every move in between.`}
    />
  );
  const details = (
    <>
      <WinGraph game={game} onSelect={onMoves} />
      <View style={styles.grid}>
        <Text style={styles.rowLabel}>Players</Text>
        <Player
          name={you}
          rating={yourElo}
          light
          uri={game.user_avatar ?? undefined}
        />
        <Player
          name={them}
          rating={theirElo}
          uri={game.opponent_avatar ?? undefined}
        />
        <Text style={styles.rowLabel}>Accuracy</Text>
        <Text
          accessibilityLabel={`Your accuracy ${fixed(yourAccuracy)}`}
          style={[styles.tile, styles.lightTile]}
        >
          {fixed(yourAccuracy)}
        </Text>
        <Text
          accessibilityLabel={`${them}'s accuracy ${fixed(game.opponent_accuracy)}`}
          style={[styles.tile, styles.darkTile]}
        >
          {fixed(game.opponent_accuracy)}
        </Text>
      </View>
      <View style={styles.card}>
        <MoveTally
          game={game}
          you={you}
          them={them}
          onSelect={(kind) => onMoves(firstOfKind(game, kind) ?? 0)}
        />
      </View>
      {slips && (
        <View style={styles.slips}>
          <Text accessibilityRole="header" style={styles.heading}>
            What slipped past you
          </Text>
          {slips.length ? (
            slips.map((row) => <SlipRowView key={row.ply} row={row} />)
          ) : (
            <Text style={styles.slipReason}>
              Nothing slipped past you in this game.
            </Text>
          )}
        </View>
      )}
    </>
  );
  const actions = slips ? (
    <>
      {onKeepWatch && <Button onPress={onKeepWatch}>Keep watch tonight</Button>}
      <Button variant={onKeepWatch ? 'secondary' : 'primary'} onPress={onStart}>
        Replay the game
      </Button>
    </>
  ) : (
    <Button onPress={onStart}>
      {reviewed ? 'Review again' : 'Start review'}
    </Button>
  );
  if (side)
    return (
      <LessonFrame
        bars={header}
        coach={bubble}
        board={side.board}
        orientation={side.board.orientation}
        bands={side.bands}
        reserve={0}
        actions={<View style={styles.panelActions}>{actions}</View>}
        side={{
          beside: side.beside,
          panel: (
            <ScrollView
              style={styles.fill}
              contentContainerStyle={styles.panelContent}
            >
              {details}
            </ScrollView>
          ),
        }}
      />
    );
  return (
    <View style={styles.fill}>
      {header}
      <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
        {bubble}
        {details}
      </ScrollView>
      <View style={[styles.pinned, { paddingBottom: insets.bottom + 16 }]}>
        {actions}
      </View>
    </View>
  );
}

/** The summary's frame while the game loads: the same layout, the knight
 * thinking, and grey stand-ins where the graph and numbers will land. */
export function ReviewSummaryLoading({ onExit }: { onExit: () => void }) {
  const styles = useStyles();
  const coach = useLoadingCoach('game');
  const blank = (
    <>
      <View style={[styles.avatar, styles.blank]} />
      <SkeletonLine width="70%" />
    </>
  );
  const tile = <View style={[styles.tile, styles.blank, styles.blankTile]} />;
  return (
    <View style={styles.fill}>
      <LessonHeader title="Game review" onClose={onExit} />
      <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
        <CoachBubble
          title={coach.title}
          body={coach.body}
          mood={coach.mood}
          lines={2}
        />
        <View style={[styles.blank, styles.blankGraph]} />
        <View style={styles.grid}>
          <Text style={styles.rowLabel}>Players</Text>
          <View style={styles.player}>{blank}</View>
          <View style={styles.player}>{blank}</View>
          <Text style={styles.rowLabel}>Accuracy</Text>
          {tile}
          {tile}
        </View>
        <View style={[styles.card, styles.blankCard]}>
          <SkeletonLine width="70%" />
          <SkeletonLine width="85%" />
          <SkeletonLine width="60%" />
        </View>
      </ScrollView>
    </View>
  );
}

function Player({
  name,
  rating,
  light = false,
  uri,
}: {
  name: string;
  rating?: number | null;
  light?: boolean;
  /** The player's own picture, when their profile has one. */
  uri?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.player}>
      <View style={[styles.avatar, light ? styles.lightTile : styles.darkTile]}>
        <Text style={[styles.initial, !light && styles.onDark]}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
        {uri && (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
        {rating ? ` · ${rating}` : ''}
      </Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  fill: { flex: 1 },
  content: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: theme.spacing.sm,
  },
  rowLabel: {
    width: '40%',
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  player: { width: '30%', alignItems: 'center', gap: 4 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
  },
  onDark: { color: '#f2f1ec' },
  name: {
    maxWidth: '100%',
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 13,
  },
  tile: {
    width: '27%',
    marginHorizontal: '1.5%',
    overflow: 'hidden',
    borderRadius: 14,
    paddingVertical: theme.spacing.sm,
    textAlign: 'center',
    fontFamily: theme.typography.heading,
    fontSize: 26,
    fontVariant: ['tabular-nums'],
  },
  lightTile: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.line,
    color: theme.colors.ink,
  },
  darkTile: { backgroundColor: '#36322c', color: '#f2f1ec' },
  blank: { backgroundColor: theme.colors.surfaceMuted },
  blankGraph: { height: 88, borderRadius: theme.radius.inset },
  // As tall as a tile's number.
  blankTile: { height: 52 },
  blankCard: { gap: theme.spacing.md },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  slips: { gap: theme.spacing.sm },
  heading: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.body + 2,
  },
  slipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  slipText: { flex: 1, minWidth: 0, gap: 4 },
  slipTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  slipReason: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  track: { flexDirection: 'row', gap: 4, paddingTop: 4 },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceMuted,
  },
  segmentLit: (tone: SlipRow['tone']) => ({
    backgroundColor:
      tone === 'stopped'
        ? theme.colors.gold
        : tone === 'held'
          ? theme.colors.brand
          : theme.colors.sky,
  }),
  panelContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
  panelActions: { gap: theme.spacing.sm },
  pinned: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
}));
