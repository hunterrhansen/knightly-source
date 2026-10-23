import { Chess } from 'chess.js';
import {
  createTransition,
  type MoveGrade,
  moveGrades,
  type Transition,
} from '../../chess/board';
import { applyMove } from '../../chess/move';
import type { GameDetail } from '../../lib/api/review-contract';
import type { ReviewStep } from './review-lesson';

type Ply = GameDetail['plies'][number];

export const gradeOf = (ply: Ply | undefined): MoveGrade | undefined =>
  ply?.classification && ply.classification in moveGrades
    ? (ply.classification as MoveGrade)
    : undefined;

// Chess.com's review stops on these for either side, plus the last book move.
const stops = new Set<MoveGrade>([
  'brilliant',
  'great',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
]);

/** The plies Next stops on, in order: the end of the opening book, every
 * notable move of either side, and every lesson step. */
export function notablePlies(game: GameDetail, steps: ReviewStep[]) {
  const plies = new Set(steps.map((s) => s.ply));
  let lastBook = 0;
  for (const m of game.plies) {
    const grade = gradeOf(m);
    if (grade === 'book') lastBook = m.ply;
    else if (grade && stops.has(grade)) plies.add(m.ply);
  }
  if (lastBook) plies.add(lastBook);
  return [...plies].sort((a, b) => a - b);
}

/** Chess.com's summary order, top to bottom. */
const tallyOrder: MoveGrade[] = [
  'brilliant',
  'great',
  'best',
  'book',
  'excellent',
  'good',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

/** How many of each kind of move each side played. */
export function tally(game: GameDetail) {
  const mine = game.color;
  return tallyOrder.map((kind) => {
    const of = (side: 'white' | 'black') =>
      game.plies.filter((m) => m.color === side && gradeOf(m) === kind).length;
    return {
      kind,
      you: of(mine ?? 'white'),
      them: of(mine === 'black' ? 'white' : 'black'),
    };
  });
}

/** The first move of a kind, yours first, then your opponent's. */
export function firstOfKind(game: GameDetail, kind: MoveGrade) {
  const of = (mine: boolean) =>
    game.plies.find(
      (m) => gradeOf(m) === kind && (m.color === game.color) === mine,
    )?.ply;
  return of(true) ?? of(false);
}

/** White's win chance (0–100) after `index` plies; 50 at the start. */
export function whiteWinPct(game: GameDetail, index: number) {
  const m = game.plies[index - 1];
  if (!m || m.win_pct_after === null) return 50;
  return m.color === 'white' ? m.win_pct_after : 100 - m.win_pct_after;
}

/** The engine evaluation after `index` plies, as players write it: +0.35,
 * −1.20, M3 (White mates) or −M3. */
export function evalText(game: GameDetail, index: number) {
  const m = game.plies[index - 1];
  if (!m) return '0.0';
  if (m.mate_after !== null && m.mate_after !== undefined)
    return `${m.mate_after < 0 ? '−' : ''}M${Math.abs(m.mate_after)}`;
  if (m.eval_after === null || m.eval_after === undefined) return '';
  const pawns = m.eval_after / 100;
  return `${pawns > 0 ? '+' : pawns < 0 ? '−' : ''}${Math.abs(pawns).toFixed(2)}`;
}

/**
 * One move between neighbouring positions animates like Chess.com: forward
 * plays it, back slides it home and restores any capture. Jumps just cut.
 */
export function stepTransition(
  before: string | undefined,
  move: string | { from: string; to: string; promotion?: string } | undefined,
  forward: boolean,
  identity: Pick<Transition, 'id' | 'positionId' | 'reason'>,
): Transition | undefined {
  if (!before || !move) return;
  try {
    const played = new Chess(before).move(move);
    const applied = applyMove(before, {
      from: played.from,
      to: played.to,
      ...(played.promotion
        ? { promotion: played.promotion as 'q' | 'r' | 'b' | 'n' }
        : {}),
    });
    if (forward) return createTransition(identity, applied);
    if (applied.motions.some((m) => m.promotedTo)) return;
    return {
      ...identity,
      motions: applied.motions.map((m) => ({ ...m, from: m.to, to: m.from })),
      ...(applied.capturedSquare
        ? { restoredSquare: applied.capturedSquare }
        : {}),
    };
  } catch {
    return;
  }
}
