import type { Color } from 'chess.js';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard, type MoveVariant } from '../../chess/board';
import {
  captureFen,
  castleFen,
  enPassantFen,
  promotionFen,
} from '../../chess/test-fixtures';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';
import { useBoardDemo } from './use-board-demo';

const examples = {
  capture: {
    label: 'Pawn capture',
    fen: captureFen,
    move: { from: 'e2', to: 'd3' },
  },
  passant: {
    label: 'En passant',
    fen: enPassantFen,
    move: { from: 'e5', to: 'd6' },
  },
  castle: { label: 'Castling', fen: castleFen, move: { from: 'e1', to: 'g1' } },
  promotion: {
    label: 'Promotion',
    fen: promotionFen,
    move: { from: 'a7', to: 'a8', promotion: 'q' },
  },
} satisfies Record<string, { label: string; fen: string; move: MoveVariant }>;
export function BoardPieceDemo({
  orientation,
  textScale,
}: {
  orientation: Color;
  textScale: number;
}) {
  const styles = useStyles();
  const [example, setExample] = useState<keyof typeof examples>('capture');
  const demo = useBoardDemo(captureFen);
  const current = examples[example];
  const ready = demo.position.fen === current.fen;
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        Piece polish
      </Text>
      <Text style={styles.body(textScale)}>
        Select or drag a piece to lift it to 1.08×. Moving pieces settle to
        0.97× then return to normal; captured pieces disappear immediately.
        Reduced motion keeps selection emphasis and skips settle. Examples stay
        local.
      </Text>
      <View style={styles.controls}>
        {(Object.keys(examples) as (keyof typeof examples)[]).map((key) => (
          <Button
            key={key}
            textScale={textScale}
            onPress={() => {
              setExample(key);
              demo.replace(examples[key].fen);
            }}
          >
            {examples[key].label}
          </Button>
        ))}
        <Button
          textScale={textScale}
          disabled={!ready}
          onPress={() =>
            demo.onAttempt({
              ...current.move,
              positionId: demo.position.id,
              attemptId: `${demo.position.id}:example`,
              source: 'activation',
            })
          }
        >
          Play example move
        </Button>
        <Button textScale={textScale} onPress={() => demo.replace(current.fen)}>
          Reset piece preview
        </Button>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.body(textScale)}>
        {current.label}:{' '}
        {ready
          ? `try ${current.move.from}–${current.move.to}, or press Play example move.`
          : demo.description}
      </Text>
      <View style={styles.board}>
        <Chessboard
          position={demo.position}
          orientation={orientation}
          policy={demo.policy}
          feedback={demo.feedback}
          presentation={{
            showDestinations: true,
            highlights: [],
            arrows: [],
            lastMove: demo.lastMove,
            transition: demo.transition,
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
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  board: { width: '100%', maxWidth: theme.layout.boardMax },
}));
