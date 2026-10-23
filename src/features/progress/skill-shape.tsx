import type { Href } from 'expo-router';
import { Text, View } from 'react-native';
import type { Overview, ProgressRange } from '../../lib/api/progress-contract';
import { createStyles, useTheme } from '../../theme/theme';
import { ActionIcon, Button, Card, LegendItem, ProgressBar } from '../../ui';
import {
  focusFor,
  MIN_SHAPE_GAMES,
  rangeNames,
  skillAxes,
  weakestAxis,
} from './progress-model';
import { SkillRadar, SkillRadarPlaceholder } from './skill-radar';

/** What to train next: the five-skill shape, the weakest axis in one
 * sentence from your games, and the one button that trains it. Locked, with
 * a count, until there is enough to score. */
export function SkillShape({
  overview,
  range,
  onOpen,
}: {
  overview: Overview;
  range: ProgressRange;
  /** Opens the training a button names (Progress leaves its modal first). */
  onOpen: (href: Href) => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const axes = skillAxes(overview.skill_shape);
  const weakest = weakestAxis(axes);
  const scored = axes.some((axis) => axis.score != null);
  const showPrevious =
    range !== 'all' && axes.every((axis) => axis.previous != null);
  if (!scored) {
    const analysed = Math.min(overview.games_analysed, MIN_SHAPE_GAMES);
    const enough = overview.games_analysed >= MIN_SHAPE_GAMES;
    return (
      <Card
        eyebrow="Game skills"
        meta={`${overview.games_analysed} games analyzed`}
      >
        {!enough && (
          <SkillRadarPlaceholder done={analysed} total={MIN_SHAPE_GAMES} />
        )}
        <View style={styles.locked}>
          <Text style={styles.lockedTitle}>
            {enough
              ? 'Your game’s shape is on its way'
              : `Your game’s shape appears after ${MIN_SHAPE_GAMES} analyzed games`}
          </Text>
          <Text style={[styles.quiet, styles.center]}>
            Safety, tactics, calculation, converting and defending, measured
            from your own moves.
          </Text>
        </View>
        {!enough && (
          <ProgressBar
            value={analysed}
            max={MIN_SHAPE_GAMES}
            label={`${analysed} of ${MIN_SHAPE_GAMES} games analyzed`}
          />
        )}
        <Button onPress={() => onOpen('/practice?mode=lesson')}>
          Start tonight’s lesson
        </Button>
      </Card>
    );
  }
  const focus = weakest ? focusFor(weakest.key, overview, range) : null;
  return (
    <Card eyebrow="Game skills" meta={rangeNames[range]}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={axes
          .map(
            (axis) =>
              `${axis.label} ${axis.score ?? 'not scored yet'}${axis.key === weakest?.key ? ', weakest' : ''}`,
          )
          .join('. ')}
      >
        <SkillRadar
          axes={axes}
          weakest={weakest?.key}
          showPrevious={showPrevious}
        />
      </View>
      <View style={styles.legend} aria-hidden>
        <LegendItem
          swatch={{ kind: 'line', color: theme.colors.brand }}
          label="Now"
        />
        {showPrevious && (
          <LegendItem
            swatch={{ kind: 'dash', color: theme.colors.inkMuted }}
            label={`${rangeNames[range]} before`}
          />
        )}
      </View>
      {focus && (
        <>
          <View style={styles.focus}>
            <View style={styles.focusIcon}>
              <ActionIcon
                name="solution"
                size={20}
                strokeWidth={2.4}
                color={theme.colors.weak}
              />
            </View>
            <View style={styles.focusText}>
              <Text style={styles.focusTitle}>{focus.title}</Text>
              {focus.evidence && (
                <Text style={styles.quiet}>{focus.evidence}</Text>
              )}
            </View>
          </View>
          <Button onPress={() => onOpen(focus.action.href as Href)}>
            {focus.action.label}
          </Button>
        </>
      )}
    </Card>
  );
}

const useStyles = createStyles((theme) => ({
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  focus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.line,
  },
  focusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.weakTint,
  },
  focusText: { flex: 1, minWidth: 0, gap: 2 },
  focusTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
  },
  locked: { gap: theme.spacing.xs, alignItems: 'center' },
  center: { textAlign: 'center' },
  lockedTitle: {
    textAlign: 'center',
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
  },
}));
