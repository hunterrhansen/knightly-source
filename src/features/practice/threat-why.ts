import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { playUci } from '../../chess/move';

/** Points as the backend counts them (threats.py): a threat wins 2 or more. */
const VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};
const THREAT_POINTS = 2;

/** The least valuable legal capture onto `square` for the side to move. */
function cheapestCapture(board: Chess, square: Square) {
  const captures = board
    .moves({ verbose: true })
    .filter((m) => m.to === square && m.captured);
  return captures.sort((a, b) => VALUES[a.piece] - VALUES[b.piece])[0];
}

/** What the side to move gains by capturing on `square` and trading on, when
 * stopping is always allowed: a static exchange, no engine. */
function exchange(board: Chess, square: Square): number {
  const capture = cheapestCapture(board, square);
  if (!capture?.captured) return 0;
  board.move(capture);
  const gain = VALUES[capture.captured] - exchange(board, square);
  board.undo();
  return Math.max(0, gain);
}

/** Why the opponent's move `given` (UCI, played from `fen`, the position the
 * question is answered from) is not their threat, in one sentence. Taken back,
 * only a pawn, or wins nothing: the reasons a learner can check on the board. */
export function whyNotThreat(fen: string, given: string): string | undefined {
  const board = new Chess(fen);
  let move: ReturnType<typeof playUci>;
  try {
    move = playUci(board, given);
  } catch {
    return undefined;
  }
  if (move.captured) {
    const back = exchange(board, move.to);
    const net = VALUES[move.captured] - back;
    if (net >= THREAT_POINTS)
      return `${move.san} looks like it wins material, but it walks into something worse for them.`;
    const recapture = cheapestCapture(board, move.to);
    if (back > 0 && recapture)
      return `${move.san} is taken straight back: ${recapture.san}.`;
    return `${move.san} only wins a pawn.`;
  }
  if (board.inCheck()) return `${move.san} is a check, but it wins nothing.`;
  return `${move.san} doesn’t win anything yet.`;
}
