import type { Color } from 'chess.js';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  type BoardProps,
  Chessboard,
  createTransition,
  type MoveVariant,
} from '../../chess/board';
import { applyMove } from '../../chess/move';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';
import { demoStart } from './use-board-demo';

// Visual contract workshop only. Completion counts never save/unlock a move.
export function BoardMotionDemo({
  initialFen = demoStart,
  move = { from: 'e2', to: 'e4' },
}: {
  initialFen?: string;
  move?: MoveVariant;
}) {
  const styles = useStyles();
  const [orientation, setOrientation] = useState<Color>('w');
  const [sequence, setSequence] = useState(0);
  const [completions, setCompletions] = useState(0);
  const [state, setState] = useState<
    Pick<BoardProps, 'position' | 'presentation' | 'feedback'>
  >({
    position: { id: 'motion-0', fen: initialFen },
    presentation: { showDestinations: false, highlights: [], arrows: [] },
  });
  const play = () => {
    const id = sequence + 1;
    setSequence(id);
    const applied = applyMove(initialFen, move);
    const positionId = `motion-${id}`;
    const attemptId = `preview-${id}`;
    setState({
      position: { id: positionId, fen: initialFen },
      feedback: {
        attemptId,
        positionId,
        outcome: 'rejected',
        message: 'Visual preview. Accept or retry.',
      },
      presentation: {
        showDestinations: false,
        highlights: [],
        arrows: [],
        preview: { attemptId, positionId, fen: applied.fen },
        transition: createTransition(
          { id: `attempt-${id}`, positionId, reason: 'attempt' },
          applied,
        ),
      },
    });
  };
  const accept = () => {
    if (!state.presentation.preview) return;
    const positionId = `accepted-${sequence}`;
    setState({
      position: { id: positionId, fen: state.presentation.preview.fen },
      presentation: {
        showDestinations: false,
        highlights: [],
        arrows: [],
        transition: createTransition(
          { id: `accept-${sequence}`, positionId, reason: 'confirmed' },
          applyMove(initialFen, move),
        ),
      },
    });
  };
  const reset = () => {
    const id = sequence + 1;
    setSequence(id);
    const positionId = `reset-${id}`;
    setState({
      position: { id: positionId, fen: initialFen },
      presentation: {
        showDestinations: false,
        highlights: [],
        arrows: [],
        transition: createTransition({
          id: positionId,
          positionId,
          reason: 'reset',
        }),
      },
    });
  };
  const retry = () => {
    if (!state.presentation.preview) return;
    const applied = applyMove(initialFen, move);
    setState({
      position: state.position,
      presentation: {
        showDestinations: false,
        highlights: [],
        arrows: [],
        transition: createTransition(
          {
            id: `retry-${sequence}`,
            positionId: state.position.id,
            reason: 'retry',
          },
          {
            motions: applied.motions.map((motion) => ({
              from: motion.to,
              to: motion.from,
              color: motion.color,
              kind: motion.promotedTo ?? motion.kind,
            })),
          },
        ),
      },
    });
  };
  return (
    <View style={styles.root}>
      <Chessboard
        {...state}
        orientation={orientation}
        policy={{ mode: 'read-only' }}
        onAttempt={() => {}}
        onTransitionComplete={() => setCompletions((count) => count + 1)}
      />
      <Text style={styles.label}>Visual completions: {completions}</Text>
      <Button onPress={play}>Play preview</Button>
      <Button onPress={accept} disabled={!state.presentation.preview}>
        Accept preview
      </Button>
      <Button onPress={retry} disabled={!state.presentation.preview}>
        Retry preview
      </Button>
      <Button onPress={reset}>Reset during motion</Button>
      <Button
        onPress={() => setOrientation((value) => (value === 'w' ? 'b' : 'w'))}
      >
        Flip during motion
      </Button>
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  root: { gap: theme.spacing.sm },
  label: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
}));
