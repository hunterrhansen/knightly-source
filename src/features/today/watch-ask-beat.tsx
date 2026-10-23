import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { Button, FadeIn, Screen, ScreenContent } from '../../ui';
import { keptWatchTime, useWatchAsk } from './watch-ask';
import { WatchForm } from './watch-screen';

/**
 * Same time tomorrow? The session-end beat after Streak extended while no
 * watch is set: the Your watch form, starting from the time this watch was
 * kept. Keep my watch saves and continues; Not now records a skip and
 * continues. One idea only, and no ✕. Fades in, at once under reduced motion.
 */
export function WatchAskBeat({
  keptAt,
  day,
  next,
}: {
  keptAt: Date;
  /** The streak day this watch kept, recorded with a skip. */
  day: string;
  /** On to the next beat, or the session's exit. */
  next: () => void;
}) {
  const styles = useStyles();
  const { skip } = useWatchAsk();
  const tonight = keptAt.getHours() >= 17 ? 'tonight’s' : 'today’s';
  const at = keptAt.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <Screen safeAreaEdges={['top', 'bottom']} avoidKeyboard>
      <FadeIn duration={tokens.motion.pop}>
        <ScreenContent style={styles.content}>
          <View style={styles.head}>
            <Text accessibilityRole="header" style={styles.title}>
              Same time tomorrow?
            </Text>
            <Text style={styles.coach}>
              {`You kept ${tonight} watch at ${at}. Tie tomorrow’s to something you already do and it sticks.`}
            </Text>
          </View>
          <WatchForm preselect={keptWatchTime(keptAt)} onDone={next} />
          <Button
            variant="text"
            onPress={() => {
              void skip(day);
              next();
            }}
          >
            Not now
          </Button>
        </ScreenContent>
      </FadeIn>
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  content: { gap: theme.spacing.lg },
  head: { gap: theme.spacing.sm },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 30,
    lineHeight: 36,
  },
  coach: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: 22,
  },
}));
