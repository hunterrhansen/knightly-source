import type { Color, PieceSymbol } from 'chess.js';
import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { Piece } from '../../chess/board/piece';
import { createStyles } from '../../theme/theme';

const hidden =
  Platform.OS === 'web'
    ? ({ 'aria-hidden': true } as const)
    : ({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      } as const);

/** The pieces of a FEN's placement, by square from a8 to h1. */
function placement(fen: string) {
  const squares: ({ kind: PieceSymbol; color: Color } | null)[] = [];
  for (const char of fen.split(' ')[0] ?? '') {
    if (char === '/') continue;
    if (/\d/.test(char)) squares.push(...Array(Number(char)).fill(null));
    else
      squares.push({
        kind: char.toLowerCase() as PieceSymbol,
        color: char === char.toUpperCase() ? 'w' : 'b',
      });
  }
  return squares.length === 64 ? squares : null;
}

/**
 * A still, small picture of a position (a move row's board): squares and
 * pieces only, `from` the learner's side. Decorative: the row
 * says what the move was.
 */
export function PositionThumbnail({
  fen,
  from = 'white',
  size = 44,
}: {
  fen: string;
  from?: 'white' | 'black';
  size?: number;
}) {
  const styles = useStyles();
  const squares = useMemo(() => placement(fen), [fen]);
  // Squares as views and pieces as the board's own Piece: one SVG document
  // with nested piece drawings rendered as a speck on iOS.
  const cell = size / 8;
  return (
    <View style={[styles.frame, { width: size, height: size }]} {...hidden}>
      {Array.from({ length: 64 }, (_, i) => {
        const piece = squares?.[from === 'white' ? i : 63 - i];
        const dark = ((i % 8) + Math.floor(i / 8)) % 2 === 1;
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed squares
            key={i}
            style={styles.square(cell, dark)}
          >
            {piece && (
              <Piece kind={piece.kind} color={piece.color} size={cell} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  square: (cell: number, dark: boolean) => ({
    width: cell,
    height: cell,
    backgroundColor: dark ? theme.colors.boardDark : theme.colors.boardLight,
  }),
  frame: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    overflow: 'hidden',
  },
}));
