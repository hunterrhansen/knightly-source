import type { Color } from 'chess.js';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard, createTransition } from '../../chess/board';
import { applyMove } from '../../chess/move';
import { startFen } from '../../chess/test-fixtures';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';

const answer = { from: 'e2', to: 'e4' } as const;
const applied = applyMove(startFen, answer);
export function BoardAnswerDemo({
  orientation,
  textScale,
}: {
  orientation: Color;
  textScale: number;
}) {
  const styles = useStyles();
  const [hint, setHint] = useState(false);
  const [corner, setCorner] = useState(false);
  const [solution, setSolution] = useState(false);
  const [played, setPlayed] = useState(false);
  const [flash, setFlash] = useState(0);
  const [run, setRun] = useState(0);
  const [landed, setLanded] = useState(false);
  const id = `answer-${run}-${played ? 'after' : 'before'}`;
  const play = () => {
    setHint(false);
    setSolution(false);
    setPlayed(true);
    setFlash((value) => value + 1);
  };
  const reset = () => {
    setRun((value) => value + 1);
    setPlayed(false);
    setFlash(0);
    setLanded(false);
    setHint(false);
    setSolution(false);
    setCorner(false);
  };
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        Hints & answer feedback
      </Text>
      <Text style={styles.body(textScale)}>
        Original Knightly’s gold glow and lightbulb identify the piece to move.
        Correct answers flash green after landing. Reduced motion keeps a steady
        outline and green tile. This is a local fixture.
      </Text>
      <View style={styles.controls}>
        <Button
          textScale={textScale}
          disabled={played}
          onPress={() => {
            setHint((value) => !value);
            setCorner(false);
          }}
        >
          {hint && !corner ? 'Hide hint' : 'Show hint'}
        </Button>
        <Button
          textScale={textScale}
          disabled={played}
          onPress={() => {
            setHint(true);
            setCorner(true);
            setSolution(false);
          }}
        >
          Preview corner hint
        </Button>
        <Button
          textScale={textScale}
          disabled={played}
          onPress={() => {
            setHint(true);
            setCorner(false);
            setSolution((value) => !value);
          }}
        >
          {solution ? 'Hide solution arrow' : 'Show solution arrow'}
        </Button>
        <Button textScale={textScale} disabled={played} onPress={play}>
          Play correct answer
        </Button>
        <Button
          textScale={textScale}
          disabled={!played || !landed}
          onPress={() => setFlash((value) => value + 1)}
        >
          Replay correct flash
        </Button>
        <Button textScale={textScale} onPress={reset}>
          Reset feedback preview
        </Button>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.body(textScale)}>
        {played
          ? 'Correct! e2–e4. The hint clears when the answer is played.'
          : hint
            ? corner
              ? 'Corner preview: h8 is marked to check bulb placement. Flip the board to inspect the opposite edge.'
              : solution
                ? 'Hint: move the pawn on e2 to e4.'
                : 'Hint: move the pawn on e2.'
            : 'Reveal a hint, or play e2–e4 by tap, drag or keyboard.'}
      </Text>
      <View style={styles.board}>
        <Chessboard
          position={{ id, fen: played ? applied.fen : startFen }}
          orientation={orientation}
          policy={
            played
              ? { mode: 'read-only' }
              : {
                  mode: 'movable',
                  sides: ['w'],
                  submissionEnabled: true,
                  moves: [answer],
                }
          }
          presentation={{
            showDestinations: true,
            highlights: [],
            arrows: solution ? [{ ...answer, tone: 'best' }] : [],
            hint: hint ? { square: corner ? 'h8' : 'e2' } : undefined,
            correct: played ? { square: 'e4', id: String(flash) } : undefined,
            lastMove: played ? answer : undefined,
            transition: played
              ? createTransition(
                  { id: `${id}:move`, positionId: id, reason: 'confirmed' },
                  applied,
                )
              : undefined,
          }}
          onAttempt={play}
          onTransitionComplete={() => setLanded(true)}
        />
      </View>
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  heading: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 28,
  },
  body: (scale: number) => ({
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: 16 * scale,
  }),
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  board: { width: '100%', maxWidth: theme.layout.boardMax },
}));
