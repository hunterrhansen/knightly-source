import { deckGrowth } from './deck-growth';

test('an empty deck says whether analysis is still running or found nothing', () => {
  expect(deckGrowth(0, { analyzed: 3, pending: 9 }, true)).toEqual({
    kind: 'analyzing',
    text: 'Analyzing your games: 3 of 12 done. Positions to practice appear as each one finishes.',
  });
  expect(deckGrowth(0, { analyzed: 4, pending: 0 }, true)).toEqual({
    kind: 'clean',
    puzzles: true,
    text: 'No clear-cut mistakes in your 4 games. Nice. Play or import more games to grow your deck. Meanwhile, practice puzzles in your weakest tactic.',
  });
  // No puzzles to offer: no promise of them.
  expect(deckGrowth(0, { analyzed: 1, pending: 0 }, false)).toMatchObject({
    text: 'No clear-cut mistakes in your 1 game. Nice. Play or import more games to grow your deck.',
  });
  expect(deckGrowth(0, { analyzed: 0, pending: 0 }, true)).toEqual({
    kind: 'no-games',
  });
});

test('a small deck says how it grows; a full one, or an older server, says nothing', () => {
  expect(deckGrowth(7, { analyzed: 12, pending: 0 }, true)).toEqual({
    kind: 'small',
    text: 'Your deck grows as you play: 7 positions from 12 games.',
  });
  expect(deckGrowth(20, { analyzed: 30, pending: 0 }, true)).toEqual({
    kind: 'growing',
  });
  expect(deckGrowth(0, undefined, true)).toEqual({ kind: 'growing' });
});
