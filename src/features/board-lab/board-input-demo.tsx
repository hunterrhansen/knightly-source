import { Text, View } from 'react-native';
import { Chessboard } from '../../chess/board';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';
import { useBoardDemo } from './use-board-demo';

export function BoardInputDemo({ initialFen }: { initialFen?: string }) {
  const styles = useStyles();
  const demo = useBoardDemo(initialFen);
  return (
    <View style={styles.root}>
      <Chessboard
        position={demo.position}
        orientation="w"
        policy={demo.policy}
        feedback={demo.feedback}
        presentation={{
          showDestinations: true,
          lastMove: demo.lastMove,
          transition: demo.transition,
          highlights: [],
          arrows: [],
        }}
        onAttempt={demo.onAttempt}
        onRestorePosition={demo.reset}
      />
      <Text style={styles.label}>
        {demo.description ??
          'Tap or drag a piece. Moves stay in this local sandbox.'}
      </Text>
      <Button onPress={demo.reset}>Reset board</Button>
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  root: { gap: theme.spacing.md },
  label: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
}));
