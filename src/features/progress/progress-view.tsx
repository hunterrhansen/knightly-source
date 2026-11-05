import { Text, View } from 'react-native';
import type { JourneyMap } from '../../lib/api/journey-contract';
import type { DailyReview } from '../../lib/api/today-contract';
import { createStyles } from '../../theme/theme';
import { Card, Page, StatTile } from '../../ui';
import {
  IsItWorking,
  type ProgressSectionsProps,
  YourGame,
  YourMemory,
} from './progress-sections';
import type { ProgressResource } from './section-state';

export type ProgressViewProps = ProgressSectionsProps & {
  journey: ProgressResource<JourneyMap>;
  streak?: DailyReview['streak'];
  onTheirWay?: number;
  importWorking?: boolean;
  onClose?: () => void;
};

/** Chess improvement, practice consistency and saved learning, without ranks. */
export function ProgressView({
  journey,
  streak,
  importWorking,
  onClose,
  ...sections
}: ProgressViewProps) {
  const styles = useStyles();
  const total = streak?.nights_total ?? journey.data?.nights.total;
  return (
    <Page title="Progress" onBack={onClose}>
      {importWorking && (
        <Text accessibilityLiveRegion="polite" style={styles.quiet}>
          Your games are still being analyzed. These numbers update as they
          finish.
        </Text>
      )}
      <IsItWorking {...sections} />
      {streak && (
        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>
            Practice consistency
          </Text>
          <Card>
            <View style={styles.tiles}>
              {total !== undefined && (
                <StatTile value={String(total)} label="practice days" />
              )}
              <StatTile value={String(streak.count)} label="in a row" />
              <StatTile value={String(streak.best)} label="best run" />
              <StatTile
                value={String(streak.freezes)}
                label={streak.freezes === 1 ? 'freeze' : 'freezes'}
              />
            </View>
          </Card>
        </View>
      )}
      <YourGame {...sections} />
      <YourMemory {...sections} moves={sections.moves ?? journey.data?.moves} />
    </Page>
  );
}
const useStyles = createStyles((theme) => ({
  group: { gap: theme.spacing.md },
  heading: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
    lineHeight: 28,
    paddingTop: theme.spacing.sm,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
}));
