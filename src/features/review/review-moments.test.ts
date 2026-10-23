import type { GameDetail } from '../../lib/api/review-contract';
import {
  evalText,
  firstOfKind,
  notablePlies,
  tally,
  whiteWinPct,
} from './review-moments';

const ply = (
  n: number,
  classification: string,
  extra: Partial<GameDetail['plies'][number]> = {},
): GameDetail['plies'][number] => ({
  ply: n,
  color: n % 2 ? 'white' : 'black',
  san: 'x',
  uci: 'e2e4',
  classification,
  best_san: null,
  best_uci: null,
  win_pct_before: 50,
  win_pct_after: 50,
  ...extra,
});
const game: GameDetail = {
  id: 1,
  white: 'Them',
  black: 'You',
  color: 'black',
  analysed: true,
  start_fen: null,
  san: [],
  reviewed_at: null,
  review_marks: [],
  accuracy: null,
  deck_plies: [],
  plies: [
    ply(1, 'book'),
    ply(2, 'book'),
    ply(3, 'good'),
    ply(4, 'mistake', { win_pct_after: 30, eval_after: 150 }),
    ply(5, 'blunder'),
    ply(6, 'brilliant', { mate_after: -3 }),
  ],
};

test('the summary counts each side’s moves for the player who reviewed', () => {
  const rows = Object.fromEntries(tally(game).map((r) => [r.kind, r]));
  expect(rows.mistake).toMatchObject({ you: 1, them: 0 });
  expect(rows.blunder).toMatchObject({ you: 0, them: 1 });
  expect(rows.book).toMatchObject({ you: 1, them: 1 });
});

test('Next stops after the book and on notable moves of either side', () => {
  expect(notablePlies(game, [])).toEqual([2, 4, 5, 6]);
});

test('evaluations read from White’s side', () => {
  expect(whiteWinPct(game, 4)).toBe(70);
  expect(evalText(game, 4)).toBe('+1.50');
  expect(evalText(game, 6)).toBe('−M3');
});

test('a summary row opens your first move of that kind, else theirs', () => {
  expect(firstOfKind(game, 'book')).toBe(2);
  expect(firstOfKind(game, 'blunder')).toBe(5);
  expect(firstOfKind(game, 'great')).toBeUndefined();
});
