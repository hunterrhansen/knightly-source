import type { Color } from 'chess.js';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard, type MoveGrade, moveGrades } from '../../chess/board';
import { squareDescription } from '../../chess/board/announcements';
import { GradeBadge } from '../../chess/board/grade-badge';
import { Square } from '../../chess/board/square';
import { startFen } from '../../chess/test-fixtures';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';
import { useBoardDemo } from './use-board-demo';

const states = [
  'normal',
  'selected',
  'focus',
  'destination',
  'capture',
  'last move',
  'hint',
  'correct',
  'rejected',
] as const;
export function BoardVisualStates({
  orientation,
  textScale,
}: {
  orientation: Color;
  textScale: number;
}) {
  const styles = useStyles();
  const [grade, setGrade] = useState<MoveGrade>('brilliant');
  const [replay, setReplay] = useState(0);
  const [rejected, setRejected] = useState(false);
  const demo = useBoardDemo();
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        Move grades & visual states
      </Text>
      <Text style={styles.body(textScale)}>
        Chess.com's classification colors and badge geometry, with Knightly's
        own glyphs. Grades are supplied by the feature; this gallery does not
        evaluate moves.
      </Text>
      <View style={styles.cards}>
        <Button
          textScale={textScale}
          onPress={() => {
            setRejected(false);
            setReplay(replay + 1);
          }}
        >
          Replay badge animation
        </Button>
        <Button
          textScale={textScale}
          onPress={() => {
            setRejected(true);
            setReplay(replay + 1);
          }}
        >
          Preview rejection fade
        </Button>
      </View>
      <Text style={styles.body(textScale)}>
        Brilliant, Great, Best, Inaccuracy, Mistake, Miss and Blunder grow in
        the square with a label, then settle on the corner (1.3 s); others and
        the rejection badge fade in over 150 ms. Your system’s reduced-motion
        preference skips the effects.
      </Text>
      <View style={styles.board}>
        <Chessboard
          position={{ id: 'grade-preview', fen: startFen }}
          orientation={orientation}
          policy={{ mode: 'read-only' }}
          presentation={{
            showDestinations: false,
            highlights: rejected ? [{ square: 'e2', tone: 'error' }] : [],
            arrows: [],
            grade: { square: 'e2', kind: grade, id: String(replay) },
          }}
          onAttempt={() => {}}
        />
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        Preview: {rejected ? 'Rejected' : moveGrades[grade].label}
      </Text>
      <View style={styles.cards}>
        {(Object.keys(moveGrades) as MoveGrade[]).map((kind) => (
          <View key={kind} style={styles.card}>
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
              style={styles.pair}
            >
              {(['e2', 'd2'] as const).map((square) => (
                <View key={square} style={styles.tile}>
                  <Square
                    square={square}
                    size={72}
                    piece={{ square, color: 'w', kind: 'n' }}
                    grade={kind}
                    label={squareDescription(
                      square,
                      { square, color: 'w', kind: 'n' },
                      { grade: kind },
                    )}
                  />
                  <View style={styles.badge}>
                    <GradeBadge grade={kind} size={28} />
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.body(textScale)}>
              {moveGrades[kind].label} · {moveGrades[kind].color}
            </Text>
            <Button
              textScale={textScale}
              onPress={() => {
                setGrade(kind);
                setRejected(false);
                setReplay(replay + 1);
              }}
            >
              {`Preview ${moveGrades[kind].label}`}
            </Button>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        Interaction & feedback
      </Text>
      <Text style={styles.body(textScale)}>
        Amber selects; a blue outline shows keyboard focus. Correct feedback is
        green. Rejection uses pale red and ×; a blunder uses ??, and a miss uses
        pink. Connection failures show a message, without a red move marker.
      </Text>
      <View style={styles.cards}>
        {states.map((state) => (
          <View key={state} style={styles.card}>
            <Text style={styles.body(textScale)}>{state}</Text>
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
              style={styles.pair}
            >
              {(['e2', 'd2'] as const).map((square) => (
                <View key={square} style={styles.tile}>
                  <Square
                    square={square}
                    size={72}
                    label={square}
                    selected={state === 'selected' || state === 'last move'}
                    focused={state === 'focus'}
                    destination={state === 'destination' || state === 'capture'}
                    piece={
                      state === 'destination'
                        ? undefined
                        : { square, color: 'w', kind: 'n' }
                    }
                    highlight={
                      state === 'hint'
                        ? 'hint'
                        : state === 'correct'
                          ? 'success'
                          : state === 'rejected'
                            ? 'error'
                            : undefined
                    }
                  />
                  {state === 'rejected' && (
                    <Text style={styles.rejected}>×</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        Try selection & legal destinations
      </Text>
      <View style={styles.board}>
        <Chessboard
          position={demo.position}
          orientation={orientation}
          policy={demo.policy}
          presentation={{
            showDestinations: true,
            lastMove: demo.lastMove,
            transition: demo.transition,
            highlights: [],
            arrows: [{ from: 'g1', to: 'f3', tone: 'analysis' }],
          }}
          onAttempt={demo.onAttempt}
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
  board: { width: '100%', maxWidth: theme.layout.boardMax },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: {
    flexBasis: 260,
    flexGrow: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
  },
  pair: { flexDirection: 'row', gap: 8 },
  tile: { width: 72, height: 72 },
  badge: { position: 'absolute', right: 2, top: 2 },
  rejected: {
    position: 'absolute',
    right: 2,
    top: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.boardRejection,
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 28,
  },
}));
