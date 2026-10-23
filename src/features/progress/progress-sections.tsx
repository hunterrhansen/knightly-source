import type { Href } from 'expo-router';
import { type PropsWithChildren, useMemo } from 'react';
import { Text, View } from 'react-native';
import { tacticNames } from '../../chess/tactics';
import type { WatchMoves } from '../../lib/api/journey-contract';
import type { Deck } from '../../lib/api/practice-contract';
import type {
  GameFilters,
  Overview,
  Patterns,
  ProgressRange,
} from '../../lib/api/progress-contract';
import { createStyles, useTheme } from '../../theme/theme';
import {
  ActionIcon,
  Card,
  Delta,
  Eyebrow,
  LegendItem,
  ListItem,
  ProgressBar,
  type StreakDays,
  type StreakNights,
} from '../../ui';
import { DeckRing } from './deck-ring';
import { HabitCard } from './habit-card';
import {
  MIN_ATTEMPTS,
  type PatternRow,
  patternRows,
  weakSpots,
} from './pattern-strength';
import {
  blunderProof,
  blunderTrend,
  rangeNames,
  TREND_MIN_GAMES,
  trendRows,
} from './progress-model';
import { RatingHero } from './rating-hero';
import { type ProgressResource, SectionState } from './section-state';
import { SkillShape } from './skill-shape';

const gamesHref = (filters: GameFilters): Href => ({
  pathname: '/games',
  params: filters,
});
const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value * 100)}%`;

type Row = {
  label: string;
  hint: string;
  value: string;
  change: number | null;
  better?: 'up' | 'down';
  digits?: number;
  href?: Href;
};

/** Every game skill as a row: value, change against the period before and,
 * where there is one, the filtered games behind it. */
function skillRows(data: Overview, range: ProgressRange): Row[] {
  const now = data.kpis;
  const before = data.previous_kpis;
  const diff = (a: number | null, b: number | null | undefined, scale = 1) =>
    a == null || b == null ? null : (a - b) * scale;
  const phase = (key: 'opening' | 'endgame') => {
    const current = data.phase_accuracy?.current[key].accuracy ?? null;
    return {
      value: current == null ? '—' : `${Math.round(current)}%`,
      change: diff(current, data.phase_accuracy?.previous?.[key].accuracy),
    };
  };
  return [
    {
      label: 'Blunders per game',
      hint: 'Lower is better',
      value:
        now.blunders_per_game == null ? '—' : now.blunders_per_game.toFixed(1),
      change: diff(now.blunders_per_game, before?.blunders_per_game),
      better: 'down',
      digits: 1,
      href: gamesHref({ range, kpi: 'blunders' }),
    },
    {
      label: 'Accuracy',
      hint: 'Every move you played',
      value: now.accuracy == null ? '—' : `${Math.round(now.accuracy)}%`,
      change: diff(now.accuracy, before?.accuracy),
    },
    {
      label: 'Converting',
      hint: 'Winning from a winning position',
      value: percent(now.conversion),
      change: diff(now.conversion, before?.conversion, 100),
      href: gamesHref({ range, kpi: 'thrown' }),
    },
    {
      label: 'Defending',
      hint: 'Saving a losing position',
      value: percent(now.comeback_rate),
      change: diff(now.comeback_rate, before?.comeback_rate, 100),
      href: gamesHref({ range, kpi: 'comebacks' }),
    },
    {
      label: 'Punishing',
      hint: 'Winning after their blunder',
      value: percent(now.punish_rate),
      change: diff(now.punish_rate, before?.punish_rate, 100),
      href: gamesHref({ range, kpi: 'unpunished' }),
    },
    {
      label: 'Opening accuracy',
      hint: 'Your first 10 moves',
      ...phase('opening'),
    },
    {
      label: 'Endgame accuracy',
      hint: 'Once few pieces are left',
      ...phase('endgame'),
    },
  ];
}

function StatRows({
  rows,
  onOpen,
}: {
  rows: Row[];
  onOpen?: (href: Href) => void;
}) {
  const styles = useStyles();
  return (
    <>
      {rows.map((row, index) => {
        const href = row.href;
        return (
          <ListItem
            key={row.label}
            label={row.label}
            description={row.hint}
            topSeparator={index > 0}
            accessibilityLabel={`${row.label}, ${row.value}. ${row.hint}`}
            onPress={href && onOpen ? () => onOpen(href) : undefined}
            trailing={
              <View style={styles.value}>
                <Text style={styles.number}>{row.value}</Text>
                <Delta
                  change={row.change}
                  better={row.better}
                  digits={row.digits}
                  size="small"
                />
              </View>
            }
          />
        );
      })}
    </>
  );
}

/** Each skill's mistakes a game in your recent games against the games
 * before, with the practice since; the count of games still needed until
 * there are enough to compare. Nothing from older servers. */
function InYourGames({
  trend,
  onOpen,
}: {
  trend: Overview['game_trend'];
  onOpen: (href: Href) => void;
}) {
  const styles = useStyles();
  if (!trend) return null;
  if (trend.reason) {
    const games = Math.min(trend.games, TREND_MIN_GAMES);
    return (
      <Card eyebrow="In your games">
        <Text style={styles.muted}>
          {`Compares each skill’s mistakes in your recent games with the games before, once ${TREND_MIN_GAMES} analyzed games are in.`}
        </Text>
        <ProgressBar
          value={games}
          max={TREND_MIN_GAMES}
          label={`${games} of ${TREND_MIN_GAMES} games analyzed`}
        />
      </Card>
    );
  }
  return (
    <Card
      eyebrow="In your games"
      meta={`Last ${trend.window} games vs the ${trend.window} before`}
    >
      <StatRows
        onOpen={onOpen}
        rows={trendRows(trend).map((row) => ({
          label: row.label,
          hint: row.hint,
          value: `${row.value} a game`,
          change: row.change,
          better: 'down',
          digits: 1,
        }))}
      />
    </Card>
  );
}

type DeckHealth = NonNullable<Patterns['deck_health']>;
const weekday = (date: string, index: number) =>
  index === 0
    ? 'Today'
    : new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
      });

/** Coming up: the week's due reviews as seven bars, the last 30 days'
 * reviews found without a miss against FSRS's 90%, and tuning. */
function ComingUp({ health }: { health: DeckHealth }) {
  const styles = useStyles();
  const most = Math.max(1, ...health.forecast.map((d) => d.due));
  const retention = health.retention;
  return (
    <Card eyebrow="Coming up" meta="Next 7 days">
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Reviews due: ${health.forecast
          .map((d, i) => `${weekday(d.date, i)} ${d.due}`)
          .join(', ')}`}
        style={styles.week}
      >
        {health.forecast.map((d, i) => (
          <View key={d.date} style={styles.day}>
            <Text style={styles.dayCount}>{d.due}</Text>
            <View style={styles.dayTrack}>
              <View
                style={[
                  styles.dayFill,
                  { height: `${Math.max(4, (100 * d.due) / most)}%` },
                  d.due === 0 && styles.dayEmpty,
                ]}
              />
            </View>
            <Text style={styles.dayName}>{weekday(d.date, i)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.muted}>
        {retention
          ? `You found ${Math.round(retention.rate * 100)}% of reviews on the first try in the last 30 days (target ${Math.round(retention.target * 100)}%).`
          : 'Your first-try rate on reviews shows once you’ve answered 20.'}
        {health.noticing
          ? ` Unannounced, you found ${Math.round(health.noticing.rate * 100)}% of positions with something to find.`
          : ''}
        {health.tuned ? ' Tuned to your memory.' : ''}
      </Text>
    </Card>
  );
}

/** Tactics by first-try rate, weakest first and marked; too few tries shows
 * the count instead of a bar. */
function TacticBars({
  rows,
  weakest,
}: {
  rows: PatternRow[];
  weakest?: string;
}) {
  const styles = useStyles();
  const sorted = [...rows].sort(
    (a, b) => (a.rate ?? 2) - (b.rate ?? 2) || b.attempts - a.attempts,
  );
  return (
    <View style={styles.bars}>
      {sorted.map((row) => {
        const name = tacticNames[row.pattern] ?? row.pattern;
        const weak = row.pattern === weakest && row.rate != null;
        const label =
          row.rate == null
            ? `${row.attempts} ${row.attempts === 1 ? 'try' : 'tries'} · needs ${MIN_ATTEMPTS}`
            : `${weak ? 'Weakest · ' : ''}${percent(row.rate)}`;
        return (
          <View key={row.pattern} style={styles.bar}>
            <View style={styles.barLabel}>
              <Text style={styles.name}>{name}</Text>
              <Text
                style={[
                  styles.rate,
                  weak && styles.weak,
                  row.rate == null && styles.muted,
                ]}
              >
                {label}
              </Text>
            </View>
            <ProgressBar
              value={row.rate == null ? 0 : Math.round(row.rate * 100)}
              tone={weak ? 'weak' : 'brand'}
              size="sm"
              label={`${name}: ${label}`}
            />
          </View>
        );
      })}
    </View>
  );
}

function ClockRows({
  timing,
}: {
  timing: NonNullable<Overview['time_management']>;
}) {
  const styles = useStyles();
  const rate = (value: number | null) =>
    value == null ? 'Soon' : `${(value * 100).toFixed(0)}%`;
  return (
    <>
      <ListItem
        label="Moves under 30 seconds"
        description={`${timing.pressure.numerator} of ${timing.pressure.decisions} timed moves`}
        trailing={
          <Text style={styles.number}>{rate(timing.pressure.rate)}</Text>
        }
      />
      <ListItem
        topSeparator
        label="Lost on time"
        description={`Of ${timing.timeouts.games} finished games`}
        trailing={
          <Text style={styles.number}>{String(timing.timeouts.losses)}</Text>
        }
      />
      <ListItem
        topSeparator
        label="Fast-move errors"
        description={
          timing.fast.rate == null
            ? `${timing.fast.games} of 50 games needed`
            : '0.2–2 seconds with two minutes left'
        }
        trailing={<Text style={styles.number}>{rate(timing.fast.rate)}</Text>}
      />
    </>
  );
}

export type ProgressSectionsProps = {
  range: ProgressRange;
  onRange: (range: ProgressRange) => void;
  overview: ProgressResource<Overview>;
  /** Last 4 weeks: the streak days of the four weeks ending today and the
   * last 30 days' blunders, whatever the range. */
  habit: {
    today: string;
    days: StreakDays | undefined;
    /** Each done day's night, for its moon phase. */
    nights?: StreakNights;
    recent: ProgressResource<Overview>;
  };
  patterns: ProgressResource<Patterns>;
  /** The deck by memory stage, for the hidden positions' count and, from an
   * older server without `moves`, the ring. */
  deck?: ProgressResource<
    Pick<Deck, 'total' | 'mastered' | 'learning' | 'new' | 'suspended'>
  >;
  /** Every move by where it is on the watch (`/api/journey`'s `moves`). */
  moves?: WatchMoves;
  /** Opens what a row or button names: inside Progress, or, leaving it, the
   * games or training behind it. */
  onOpen: (href: Href) => void;
};

/** A group of Progress's one sheet: a heading over its cards. */
function Group({
  title,
  meta,
  children,
}: PropsWithChildren<{ title: string; meta?: string }>) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text accessibilityRole="header" style={styles.groupTitle}>
          {title}
        </Text>
        {meta && <Eyebrow tone="muted">{meta}</Eyebrow>}
      </View>
      {children}
    </View>
  );
}

/** "Is it working?": blunders per game against the 30 days before, the
 * rating with its range chips, and the last four weeks of nights. */
export function IsItWorking({
  range,
  onRange,
  overview,
  habit,
}: Pick<ProgressSectionsProps, 'range' | 'onRange' | 'overview' | 'habit'>) {
  const styles = useStyles();
  const data = overview.data;
  const recent = habit.recent.data;
  const proof = blunderProof(
    recent?.kpis.blunders_per_game,
    recent?.previous_kpis?.blunders_per_game,
  );
  const falling =
    blunderTrend(
      recent?.kpis.blunders_per_game,
      recent?.previous_kpis?.blunders_per_game,
    )?.better ?? false;
  return (
    <Group title="Is it working?">
      <SectionState
        resource={habit.recent}
        name="your blunders"
        eyebrow="Proof"
      />
      {recent && (
        <View
          accessible
          accessibilityLabel={
            proof
              ? `Blunders per game, ${proof.text.replace('→', 'to')}`
              : 'Blunders per game, not enough analyzed games yet'
          }
          style={styles.proofRow}
        >
          <View style={styles.proofText}>
            <Text style={styles.proofLabel}>Blunders per game</Text>
            <Text style={styles.muted}>Last 30 days vs the 30 before</Text>
          </View>
          <Text
            style={[styles.proofValue, proof?.better === true && styles.better]}
          >
            {proof?.text ?? '—'}
          </Text>
        </View>
      )}
      <SectionState resource={overview} name="your rating" eyebrow="Rating" />
      {data && (
        <RatingHero
          overview={data}
          range={range}
          onRange={onRange}
          blundersFalling={falling}
        />
      )}
      <SectionState
        resource={habit.recent}
        name="the last 4 weeks"
        eyebrow="Last 4 weeks"
      />
      {recent && (
        <HabitCard
          days={habit.days}
          nights={habit.nights}
          today={habit.today}
          recent={recent}
        />
      )}
    </Group>
  );
}

/** "Your game": the skill shape, each skill's numbers, mistakes in your
 * games, tactics, the clock and openings, each linking to the games or
 * training behind it. */
export function YourGame({
  range,
  overview,
  patterns,
  onOpen,
}: Pick<ProgressSectionsProps, 'range' | 'overview' | 'patterns' | 'onOpen'>) {
  const styles = useStyles();
  const data = overview.data;
  const rows = useMemo(
    () => (patterns.data ? patternRows(patterns.data) : []),
    [patterns.data],
  );
  const weakest = weakSpots(rows, 1)[0]?.pattern;
  return (
    <Group
      title="Your game"
      meta={range === 'all' ? 'All time' : `Last ${rangeNames[range]}`}
    >
      {data && <SkillShape overview={data} range={range} onOpen={onOpen} />}
      {data && (
        <Card eyebrow="Skill by skill">
          <StatRows rows={skillRows(data, range)} onOpen={onOpen} />
        </Card>
      )}
      {data && <InYourGames trend={data.game_trend} onOpen={onOpen} />}
      <SectionState resource={patterns} name="tactics" eyebrow="Tactics" />
      {patterns.data && (
        <Card eyebrow="Tactics" meta="Solved on the first try">
          {rows.length ? (
            <TacticBars rows={rows} weakest={weakest} />
          ) : (
            <Text style={styles.muted}>
              Tactics show here once you’ve practiced a few.
            </Text>
          )}
        </Card>
      )}
      {data?.time_management && (
        <Card eyebrow="Clock" meta="10+0 games">
          <ClockRows timing={data.time_management} />
        </Card>
      )}
      {data && data.top_openings.length > 0 && (
        <Card eyebrow="Openings">
          {data.top_openings.map((opening, index) => (
            <ListItem
              key={`${opening.eco}-${opening.color}`}
              topSeparator={index > 0}
              label={opening.opening || opening.eco || 'Unknown opening'}
              description={`${opening.color === 'white' ? 'As White' : 'As Black'} · ${opening.games} games`}
              accessibilityLabel={`${opening.opening || opening.eco || 'Unknown opening'}, ${percent(opening.win_rate)} wins`}
              onPress={() =>
                onOpen(
                  gamesHref({
                    range,
                    q: opening.eco ?? opening.opening ?? undefined,
                    color: opening.color,
                  }),
                )
              }
              trailing={
                <Text
                  style={styles.number}
                >{`${percent(opening.win_rate)} wins`}</Text>
              }
            />
          ))}
        </Card>
      )}
    </Group>
  );
}

/** The ring's moves: by where they are on the watch, or, from an older
 * server, the deck by memory stage. */
function ringOf(
  moves: WatchMoves | undefined,
  deck: NonNullable<ProgressSectionsProps['deck']>['data'],
  colors: { gold: string; brand: string; sky: string; inkMuted: string },
) {
  if (moves) {
    const total = moves.on_watch + moves.held + moves.stopped;
    return {
      total,
      center: { count: moves.stopped, label: 'stopped' },
      accessibilityLabel: `${moves.on_watch} on watch, ${moves.held} held, ${moves.stopped} stopped slipping`,
      segments: [
        { value: moves.stopped, color: colors.gold },
        { value: moves.held, color: colors.brand },
        { value: moves.on_watch, color: colors.sky },
      ],
      legend: [
        {
          kind: 'dot' as const,
          color: colors.sky,
          label: 'On watch',
          count: moves.on_watch,
        },
        {
          kind: 'dot' as const,
          color: colors.brand,
          label: 'Held',
          count: moves.held,
        },
        {
          kind: 'dot' as const,
          color: colors.gold,
          label: 'Stopped slipping',
          count: moves.stopped,
        },
      ],
    };
  }
  if (!deck) return null;
  return {
    total: deck.total,
    center: { count: deck.mastered, label: 'long-term' },
    accessibilityLabel: `${deck.mastered} long-term, ${deck.learning} learning, ${deck.new} new`,
    segments: [
      { value: deck.mastered, color: colors.brand },
      { value: deck.learning, color: colors.sky },
    ],
    legend: [
      {
        kind: 'dot' as const,
        color: colors.brand,
        label: 'Long-term',
        count: deck.mastered,
      },
      {
        kind: 'dot' as const,
        color: colors.sky,
        label: 'Learning',
        count: deck.learning,
      },
      {
        kind: 'ring' as const,
        color: colors.inkMuted,
        label: 'New',
        count: deck.new,
      },
    ],
  };
}

/** "Your memory": your moves by where they are on the watch, and the
 * reviews coming up over the next seven days. */
export function YourMemory({
  patterns,
  deck,
  moves,
  onOpen,
}: Pick<ProgressSectionsProps, 'patterns' | 'deck' | 'moves' | 'onOpen'>) {
  const styles = useStyles();
  const { theme } = useTheme();
  const ring = ringOf(moves, deck?.data, theme.colors);
  const health = patterns.data?.deck_health;
  if ((!ring || ring.total === 0) && !health) return null;
  return (
    <Group title="Your memory">
      {ring && ring.total > 0 && (
        <Card eyebrow="Your moves" meta={`${ring.total} moves`}>
          <View style={styles.deckRow}>
            <DeckRing
              segments={ring.segments}
              total={ring.total}
              center={ring.center}
              accessibilityLabel={ring.accessibilityLabel}
            />
            <View style={styles.deckLegend} aria-hidden>
              {ring.legend.map((item) => (
                <LegendItem
                  key={item.label}
                  swatch={{ kind: item.kind, color: item.color }}
                  label={item.label}
                  count={item.count}
                />
              ))}
            </View>
          </View>
          {!!deck?.data?.suspended && (
            <ListItem
              label={`${deck.data.suspended} hidden`}
              description="Positions you chose not to see again"
              topSeparator
              accessibilityLabel={`${deck.data.suspended} hidden positions`}
              onPress={() => onOpen('/progress/hidden')}
              trailing={
                <ActionIcon
                  name="next"
                  size={18}
                  strokeWidth={2.6}
                  color={theme.colors.inkMuted}
                />
              }
            />
          )}
        </Card>
      )}
      {health && <ComingUp health={health} />}
    </Group>
  );
}

const useStyles = createStyles((theme) => ({
  group: { gap: theme.spacing.md },
  groupHead: { gap: 2, paddingTop: theme.spacing.sm },
  groupTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
    lineHeight: 28,
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: theme.layout.listItemMin,
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  proofText: { flex: 1, minWidth: 0, gap: 2 },
  proofLabel: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  proofValue: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  better: { color: theme.colors.brandText },
  value: { alignItems: 'flex-end', gap: 2 },
  number: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  bars: { gap: theme.spacing.md },
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  dayTrack: { width: '100%', height: 64, justifyContent: 'flex-end' },
  dayFill: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.brand,
  },
  dayEmpty: { backgroundColor: theme.colors.line },
  dayCount: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    fontVariant: ['tabular-nums'],
  },
  dayName: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  bar: { gap: 6 },
  barLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  name: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 15,
  },
  rate: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    fontVariant: ['tabular-nums'],
  },
  weak: { color: theme.colors.weak },
  muted: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  deckRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  deckLegend: { flex: 1, gap: theme.spacing.sm },
}));
