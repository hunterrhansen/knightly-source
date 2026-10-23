import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export type Piece = Readonly<{
  square: Square;
  color: Color;
  kind: PieceSymbol;
}>;
export type Position = Readonly<{ id: string; fen: string }>;
export const pieceNames: Readonly<Record<PieceSymbol, string>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};
export type ParsedPosition = Readonly<{
  pieces: readonly Piece[];
  turn: Color;
}>;

/** Stands in for a FEN on a board with no pieces, shown read-only while a
 * lesson's first position loads. A sentinel, not a FEN: an empty FEN from the
 * server is still an invalid position. */
export const EMPTY_BOARD = 'empty';

export function parsePosition(
  fen: string,
  options: Readonly<{ skipValidation?: boolean }> = {},
): { ok: true; value: ParsedPosition } | { ok: false; message: string } {
  if (fen === EMPTY_BOARD)
    return { ok: true, value: { pieces: [], turn: 'w' } };
  try {
    const chess = new Chess(fen, options);
    const pieces = chess
      .board()
      .flatMap((row) =>
        row.flatMap((piece) =>
          piece
            ? [{ square: piece.square, color: piece.color, kind: piece.type }]
            : [],
        ),
      );
    return { ok: true, value: { pieces, turn: chess.turn() } };
  } catch {
    return {
      ok: false,
      message: 'Position unavailable: invalid chess position.',
    };
  }
}
