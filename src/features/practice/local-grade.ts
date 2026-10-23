import { Chess } from 'chess.js';
import { playUci } from '../../chess/move';
import type {
  PracticeCard,
  PracticeResult,
  PracticeStep,
} from '../../lib/api/practice-contract';

const SKIP = '0000';
const passing = (quality: string) =>
  quality === 'best' || quality === 'excellent' || quality === 'good';

/** Plays `moves` from `fen`, or undefined when any is illegal. */
function play(fen: string, moves: readonly string[]) {
  try {
    const board = new Chess(fen);
    for (const uci of moves) playUci(board, uci);
    return board;
  } catch {
    return undefined;
  }
}

/** The served solution when it can be trusted: legal from `fen`, ending on a
 * learner move (odd length). Otherwise undefined, and the server grades. */
export function trustedLine(fen: string, line: readonly string[] | undefined) {
  if (!line?.length || line.length % 2 === 0 || !play(fen, line))
    return undefined;
  return [...line];
}

/** Grades the last learner move of `moves` exactly as the server's
 * `practice_lines.step` does, from the served line and (for own-game cards)
 * the first-move grade map. Undefined when only the server can say: a move
 * list the line can't have produced, or a first move the map doesn't grade. */
export function gradeLocally({
  fen,
  line,
  moves,
  hinted,
  kind,
  grades,
}: {
  fen: string;
  line: readonly string[];
  moves: readonly string[];
  hinted: boolean;
  /** Own-game cards accept close first moves, graded by the map or the server's
   * engine; puzzles accept only the line or a mate. */
  kind: 'card' | 'puzzle';
  grades?: NonNullable<PracticeCard['feedback']>['grades'];
}): PracticeStep | undefined {
  if (!moves.length || moves.length % 2 === 0 || moves.length > line.length)
    return undefined;
  if (moves.slice(0, -1).some((uci, i) => uci !== line[i])) return undefined;
  const index = moves.length - 1;
  const uci = moves[index] ?? '';
  const expected = line[index] ?? '';
  const step = Math.floor(index / 2);
  const before = play(fen, moves.slice(0, -1));
  if (!before) return undefined;
  const sanOf = (from: Chess, move: string) => {
    const board = new Chess(from.fen());
    return playUci(board, move).san;
  };
  const sans: string[] = [];
  const walk = new Chess(fen);
  for (const move of line) {
    sans.push(sanOf(walk, move));
    playUci(walk, move);
  }
  const terminal = (
    status: PracticeResult['status'],
    quality: PracticeResult['quality'],
  ): PracticeResult => {
    const correct = passing(quality);
    return {
      status,
      step,
      correct,
      quality,
      // The server's first-answer rating, as far as the screen needs it.
      rating:
        hinted || !correct ? 'again' : quality === 'good' ? 'hard' : 'good',
      best_uci: expected,
      best_san: sans[index] ?? expected,
      line: { uci: [...line], san: sans },
      due: null,
      mastered: false,
    };
  };
  if (uci === SKIP) return terminal('shown', 'shown');
  if (uci === expected) {
    const reply = line[index + 1];
    if (reply) {
      const after = play(fen, moves);
      if (!after) return undefined;
      return {
        status: 'continue',
        step,
        reply_uci: reply,
        reply_san: sanOf(after, reply),
      };
    }
    return terminal('solved', 'best');
  }
  const after = play(fen, moves);
  if (!after) return terminal('failed', 'wrong');
  if (after.isCheckmate()) return terminal('solved', 'best');
  if (index === 0 && kind === 'card') {
    const quality = grades?.[uci];
    // Not in the map: the server's engine grades it.
    if (!quality) return undefined;
    return terminal(passing(quality) ? 'solved' : 'failed', quality);
  }
  return terminal('failed', 'wrong');
}
