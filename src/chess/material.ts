import { Chess, type Color, type PieceSymbol } from 'chess.js';

const start: Record<PieceSymbol, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};
const values: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};
// Chess.com's order: pawns first, the queen last.
const order: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q'];

/** The opponent's pieces `side` has taken and how far `side` leads on
 * material (0 when level or behind). Read from the board alone, so a promoted
 * pawn reads as taken; the lead still counts its new piece. */
export function capturedBy(fen: string, side: Color) {
  const left = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const row of new Chess(fen, { skipValidation: true }).board())
    for (const piece of row) if (piece) left[piece.color][piece.type] += 1;
  const opponent: Color = side === 'w' ? 'b' : 'w';
  const taken = order.flatMap((kind) =>
    Array<PieceSymbol>(Math.max(0, start[kind] - left[opponent][kind])).fill(
      kind,
    ),
  );
  const material = (color: Color) =>
    order.reduce((sum, kind) => sum + values[kind] * left[color][kind], 0);
  return {
    taken,
    lead: Math.max(0, material(side) - material(opponent)),
  };
}
