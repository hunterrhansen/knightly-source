import type { Color } from 'chess.js';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard, type MoveVariant } from '../../chess/board';
import { applyMove } from '../../chess/move';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';
import { useLineAnnouncement } from './use-line-announcement';

const lineDemoFen = '4k3/8/8/2p5/3Q4/8/4P3/4K3 w - - 0 1';
const lines = {
  best: [
    { from: 'd4', to: 'd1' },
    { from: 'c5', to: 'c4' },
  ],
  why: [
    { from: 'e2', to: 'e3' },
    { from: 'c5', to: 'd4' },
  ],
} as const satisfies Record<string, readonly MoveVariant[]>;
function lineDemoPosition(kind: keyof typeof lines, step: number) {
  return lines[kind]
    .slice(0, step)
    .reduce((fen, move) => applyMove(fen, move).fen, lineDemoFen);
}
export function BoardLineDemo({
  orientation,
  textScale,
}: {
  orientation: Color;
  textScale: number;
}) {
  const styles = useStyles();
  const [kind, setKind] = useState<keyof typeof lines | null>(null);
  const [step, setStep] = useState(0);
  const next = kind ? lines[kind][step] : lines.best[0];
  const explanation = !kind
    ? 'White’s queen is attacked by the c5 pawn. The green arrow shows a safe retreat.'
    : kind === 'best'
      ? [
          'Move the queen to safety on d1.',
          'The queen is safe. Black can advance the pawn.',
          'The queen survives this continuation.',
        ][step]
      : [
          'Moving the e-pawn ignores the threat to the queen.',
          'Black can capture the queen: the red arrow shows the punishment.',
          'The pawn captured the queen. This is why ignoring the threat fails.',
        ][step];
  const arrowTone = !kind
    ? 'best'
    : kind === 'why' && step === 1
      ? 'danger'
      : 'line';
  const arrowDescription = next
    ? `${arrowTone === 'best' ? 'Best-move' : arrowTone === 'danger' ? 'Punishment' : 'Continuation'} arrow: ${next.from} to ${next.to}.`
    : 'End of line. No next-move arrow.';
  const description = `${kind ? `Analysis line — ${kind === 'best' ? 'safe queen retreat' : 'punishment'}. Step ${step} of ${lines[kind].length}.` : 'Game position — White to move.'} ${explanation} ${arrowDescription}`;
  useLineAnnouncement(description);
  const enter = (choice: keyof typeof lines) => {
    setKind(choice);
    setStep(0);
  };
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        Arrows & explanation lines
      </Text>
      <Text style={styles.body(textScale)}>
        Fixture demonstration: no engine evaluation or saved progress. Green =
        best move; blue = continuation; red = punishment.
      </Text>
      <View style={styles.controls}>
        <Button textScale={textScale} onPress={() => enter('best')}>
          Show best line
        </Button>
        <Button textScale={textScale} onPress={() => enter('why')}>
          Show why the pawn move fails
        </Button>
        <Button
          textScale={textScale}
          disabled={!kind}
          onPress={() => {
            setKind(null);
            setStep(0);
          }}
        >
          Return to game
        </Button>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.body(textScale)}>
        {description}
      </Text>
      <View style={styles.board}>
        <Chessboard
          position={{
            id: `line-demo:${kind ?? 'game'}:${step}`,
            fen: kind ? lineDemoPosition(kind, step) : lineDemoFen,
          }}
          orientation={orientation}
          policy={{ mode: 'read-only' }}
          presentation={{
            showDestinations: false,
            lineMode: !!kind,
            lastMove: kind && step > 0 ? lines[kind][step - 1] : undefined,
            highlights: [],
            arrows: next ? [{ ...next, tone: arrowTone }] : [],
          }}
          onAttempt={() => {}}
        />
      </View>
      <View style={styles.controls}>
        <Button
          textScale={textScale}
          disabled={!kind || step === 0}
          onPress={() => setStep(step - 1)}
        >
          Previous line move
        </Button>
        <Button
          textScale={textScale}
          disabled={!kind || step === lines[kind].length}
          onPress={() => setStep(step + 1)}
        >
          Next line move
        </Button>
      </View>
      <Text style={styles.body(textScale)}>
        Game history stays unchanged. Returning restores the original
        queen-and-pawn position. Flip, theme and large-text controls above also
        apply here.
      </Text>
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  heading: {
    fontFamily: theme.typography.heading,
    fontSize: 28,
    color: theme.colors.ink,
  },
  body: (scale: number) => ({
    fontFamily: theme.typography.body,
    fontSize: 16 * scale,
    color: theme.colors.ink,
  }),
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  board: { width: '100%', maxWidth: theme.layout.boardMax },
}));
