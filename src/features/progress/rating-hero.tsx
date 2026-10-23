import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { Overview, ProgressRange } from '../../lib/api/progress-contract';
import { createStyles } from '../../theme/theme';
import { Delta, Eyebrow, IconButton, ToggleGroup } from '../../ui';
import { ChartPanel } from './chart-panel';
import { ChartSurface } from './chart-surface';
import { MIN_RATED_GAMES, rangeNames } from './progress-model';
import { ratingPoints } from './rating-points';

const ranges = [
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
] as const;

const dateLabel = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** The page's headline: the latest rating, its change over the period and
 * the line behind it, with the period chips that drive the page. */
export function RatingHero({
  overview,
  range,
  onRange,
  blundersFalling,
}: {
  overview: Overview;
  range: ProgressRange;
  onRange: (range: ProgressRange) => void;
  /** A falling rating reads differently while the habit still works. */
  blundersFalling: boolean;
}) {
  const styles = useStyles();
  const points = useMemo(
    () => ratingPoints(overview.rating_series),
    [overview.rating_series],
  );
  const games = points.length;
  const trend = games >= MIN_RATED_GAMES;
  const change = trend ? overview.rating.change : null;
  const note = !trend
    ? 'Your trend fills in as you play rated games.'
    : change != null && change < 0 && blundersFalling
      ? 'Ratings swing week to week. Your blunders are still falling.'
      : 'Rated games, all time controls.';
  return (
    <View style={styles.hero}>
      <Eyebrow tone="muted">Rating</Eyebrow>
      <View style={styles.numberRow}>
        <Text style={styles.number}>
          {overview.rating.current == null
            ? '—'
            : String(Math.round(overview.rating.current))}
        </Text>
        {trend ? (
          <Delta change={change} suffix={`· ${rangeNames[range]}`} />
        ) : (
          <Text style={styles.quiet}>
            {`${games} rated ${games === 1 ? 'game' : 'games'}`}
          </Text>
        )}
      </View>
      <Text style={styles.quiet}>{note}</Text>
      {trend ? (
        <RatingLine key={range} points={points} />
      ) : (
        <View style={styles.placeholder} aria-hidden />
      )}
      <ToggleGroup
        label="Progress period"
        value={range}
        options={ranges}
        onChange={onRange}
        variant="pills"
      />
    </View>
  );
}

function RatingLine({ points }: { points: ReturnType<typeof ratingPoints> }) {
  const styles = useStyles();
  const [selected, setSelected] = useState(points.length - 1);
  const game = points[selected];
  const step = (by: number) =>
    setSelected((index) =>
      Math.max(0, Math.min(points.length - 1, index + by)),
    );
  return (
    <View style={styles.line}>
      <ChartPanel>
        <ChartSurface
          data={points}
          selected={selected}
          onSelect={setSelected}
        />
      </ChartPanel>
      {game && (
        <View style={styles.readout}>
          <Text
            testID="selected-game"
            accessibilityLiveRegion="polite"
            style={styles.readoutText}
          >
            {`${selected === points.length - 1 ? 'Latest · ' : ''}${dateLabel(game.timestamp)} · ${game.rating}${game.opponent ? ` vs ${game.opponent}` : ''}`}
          </Text>
          <IconButton
            icon="previous"
            iconSize={20}
            compact
            accessibilityLabel="Previous game"
            disabled={selected === 0}
            onPress={() => step(-1)}
          />
          <IconButton
            icon="next"
            iconSize={20}
            compact
            accessibilityLabel="Next game"
            disabled={selected === points.length - 1}
            onPress={() => step(1)}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  hero: { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.xs },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 10,
  },
  number: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.display,
    fontVariant: ['tabular-nums'],
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
  },
  line: { gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  placeholder: {
    height: 66,
    marginVertical: theme.spacing.md,
    borderBottomWidth: 3,
    borderStyle: 'dashed',
    borderColor: theme.colors.line,
  },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readoutText: {
    flex: 1,
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
}));
