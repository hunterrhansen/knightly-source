import { View } from 'react-native';
import type { Overview } from '../../lib/api/progress-contract';
import { createStyles } from '../../theme/theme';
import {
  Callout,
  Card,
  Delta,
  StatTile,
  StreakDay,
  type StreakDays,
  type StreakNights,
} from '../../ui';
import {
  blunderTrend,
  currentRun,
  HABIT_DAYS,
  lastFourWeeks,
} from './progress-model';

/** Is the practice working? Nights practiced next to blunders per game, the
 * four weeks of moons, and one line joining the two. Ignores the range. */
export function HabitCard({
  days,
  nights,
  today,
  recent,
}: {
  /** Streak days from the backend; undefined while loading (blank cells). */
  days: StreakDays | undefined;
  /** Each done day's night, for its moon phase. */
  nights?: StreakNights;
  today: string;
  /** The last 30 days' overview, for blunders against the 30 before. */
  recent: Pick<Overview, 'kpis' | 'previous_kpis'> | undefined;
}) {
  const styles = useStyles();
  const cells = lastFourWeeks(days, today);
  const practiced = cells.filter((cell) => cell.state === 'done').length;
  const run = currentRun(cells);
  const now = recent?.kpis.blunders_per_game;
  const before = recent?.previous_kpis?.blunders_per_game;
  const trend = blunderTrend(now, before);
  return (
    <Card
      eyebrow="Last 4 weeks"
      meta={
        run ? `${run} ${run === 1 ? 'night' : 'nights'} in a row` : undefined
      }
    >
      <View style={styles.tiles}>
        <StatTile
          value={String(practiced)}
          unit={`/ ${HABIT_DAYS}`}
          label="nights practiced"
        />
        <StatTile
          value={now == null ? '—' : now.toFixed(1)}
          label="blunders per game"
          accessibilityLabel={
            now == null
              ? 'Blunders per game: not enough games yet'
              : `${now.toFixed(1)} blunders per game`
          }
          change={
            now == null ? undefined : (
              <Delta
                change={before == null ? null : now - before}
                better="down"
                digits={1}
                size="small"
              />
            )
          }
        />
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${practiced} of the last ${HABIT_DAYS} nights practiced`}
        style={styles.grid}
      >
        {cells.map((cell) => (
          <View key={cell.id} style={styles.cell}>
            <StreakDay
              label=""
              accessibilityLabel=""
              // A missed night is a plain cell here; the calendar's missed day
              // relies on its number, which the grid leaves out.
              state={cell.state === 'missed' ? 'none' : cell.state}
              faded={false}
              night={nights?.[cell.id]}
              atRisk={false}
            />
          </View>
        ))}
      </View>
      {trend ? (
        <Callout
          icon={trend.better ? 'down' : 'up'}
          tone={trend.better ? 'brand' : 'muted'}
        >
          {trend.text}
        </Callout>
      ) : (
        <Callout icon="up" tone="muted">
          Practice most nights and your blunders start to drop.
        </Callout>
      )}
    </Card>
  );
}

const useStyles = createStyles((theme) => ({
  tiles: { flexDirection: 'row', gap: 10 },
  // Capped so wide pages keep the moons together as one block.
  grid: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.spacing.sm,
  },
  cell: { width: `${100 / 7}%`, alignItems: 'center' },
}));
