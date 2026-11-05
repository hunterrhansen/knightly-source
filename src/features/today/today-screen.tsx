import { Platform, Text, View } from 'react-native';
import type { JourneyMap } from '../../lib/api/journey-contract';
import { createStyles } from '../../theme/theme';
import { Body, Button, Card, Notice, Page } from '../../ui';
import type { TodayActions, TodayLearnMore, Tonight } from './node-card';
import type { TodayState } from './today-state';
import { StreakButton } from './today-streak-badge';

export type { TodayActions, Tonight };

/** Daily practice and game review, without a journey or rank gate. */
export function TodayScreen({
  state,
  actions,
  notice,
  learnMore,
}: {
  state: TodayState;
  actions: TodayActions;
  notice?: string;
  accountName?: string;
  learnMore?: TodayLearnMore;
  journey?: JourneyMap;
  now?: Date;
  focused?: boolean;
}) {
  const styles = useStyles();
  const next = state.kind === 'done' ? state.next : null;
  const game = 'game' in state ? state.game : null;
  const review = 'review' in state ? state.review : undefined;
  const active =
    state.kind === 'first' ||
    state.kind === 'ready' ||
    state.kind === 'returning' ||
    state.kind === 'at-risk'
      ? state
      : undefined;
  return (
    <Page title="Today">
      {Platform.OS === 'web' && (
        <View style={styles.bar}>
          {review && <StreakButton streak={review.streak} />}
        </View>
      )}
      {notice && <Notice title={notice} />}
      {state.kind === 'loading' && <Notice title="Loading your practice…" />}
      {state.kind === 'error' && (
        <Notice
          title="Practice unavailable"
          message={state.message}
          action="Retry"
          onAction={actions.retry}
        />
      )}
      {state.kind === 'new' && (
        <Card eyebrow="Learn from your games">
          <Body>
            Connect your chess account to find positions worth practicing.
          </Body>
          <Button onPress={actions.connectGames}>Connect your games</Button>
        </Card>
      )}
      {state.kind === 'processing' && (
        <Notice
          title="Analyzing your games…"
          message={
            state.checked
              ? `${state.checked.done} of ${state.checked.total} games analyzed. Practice appears when positions are ready.`
              : 'Practice appears when positions are ready.'
          }
        />
      )}
      {active && (
        <Card eyebrow={`Daily practice · about ${active.minutes} min`}>
          <Text accessibilityRole="header" style={styles.heading}>
            {active.start.kind === 'game'
              ? 'Review your game'
              : 'Practice from your games'}
          </Text>
          <Body>
            {active.start.kind === 'lesson'
              ? `${active.start.done} of ${active.start.total} positions completed. Revisit mistakes and practice recognizing threats.`
              : 'Review key moments and find better moves.'}
          </Body>
          {state.kind === 'at-risk' && (
            <Body>There’s still time to extend your streak today.</Body>
          )}
          <Button onPress={() => actions.open(active.start.href)}>
            {active.start.kind === 'game'
              ? 'Review game'
              : active.start.kind === 'lesson' && active.start.done > 0
                ? 'Continue practice'
                : 'Start practice'}
          </Button>
          {game && (
            <Button variant="text" onPress={() => actions.open(game.href)}>
              Review your latest game
            </Button>
          )}
        </Card>
      )}
      {state.kind === 'done' && (
        <Card eyebrow="Practice complete">
          <Text accessibilityRole="header" style={styles.heading}>
            Your results are saved
          </Text>
          <Body>Your next reviews are scheduled. You can stop here.</Body>
          {next && (
            <Button onPress={() => actions.open(next.href)}>
              {next.kind === 'game' ? 'Review your game' : 'Continue practice'}
            </Button>
          )}
          {learnMore && (
            <Button disabled={learnMore.busy} onPress={learnMore.onPress}>
              Practice more
            </Button>
          )}
          {learnMore?.error && <Body>{learnMore.error}</Body>}
        </Card>
      )}
      {state.kind === 'rest' && (
        <Notice
          title="No practice due"
          message="New positions appear as your games are analyzed and scheduled reviews become ready."
        />
      )}
      <Button variant="text" onPress={() => actions.open('/watch')}>
        Practice reminders
      </Button>
    </Page>
  );
}
const useStyles = createStyles((theme) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontFamily: theme.typography.heading,
    color: theme.colors.ink,
    fontSize: 24,
    lineHeight: 30,
  },
}));
