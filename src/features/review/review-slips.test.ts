import type { GameDetail } from '../../lib/api/review-contract';
import { slipRows } from './review-slips';

const move = (ply: number, san: string, best_san: string | null) =>
  ({ ply, san, best_san }) as GameDetail['plies'][number];
const plies = [
  move(1, 'e4', null),
  move(2, 'Nf6', 'e5'),
  move(3, 'd4', null),
  move(4, 'Ng4', 'd6'),
  move(5, 'h3', null),
  move(6, 'Qd7', null),
  move(7, 'Nf3', null),
  move(8, 'Bc5', 'Be7'),
];
const card = (
  ply: number,
  state: 'on_watch' | 'held' | 'stopped',
  due: string | null,
  held = 0,
) => ({ ply, state, due, label: 'Fork', reason: null, held });

test('slipped moves read in move order with a track and when each comes back', () => {
  // Wednesday, 14 October 2026.
  const rows = slipRows(
    {
      plies,
      deck_cards: [
        card(8, 'stopped', '2026-12-30', 5),
        card(2, 'on_watch', null),
        card(4, 'on_watch', '2026-10-16'),
        {
          ...card(6, 'held', '2026-10-20', 2),
          reason: 'Your queen was loose.',
        },
      ],
    },
    '2026-10-14',
  );
  expect(rows?.map((r) => [r.title, r.reason, r.lit, r.chip])).toEqual([
    ['Fork · Nf6', 'Best was e5.', 1, 'Tonight'],
    ['Fork · Ng4', 'Best was d6.', 1, 'Friday'],
    ['Fork · Qd7', 'Your queen was loose.', 3, 'Held 3 of 4'],
    ['Fork · Bc5', 'Best was Be7.', 4, 'Stopped slipping'],
  ]);
});

test('a held move due tonight says Tonight, and older servers show no slips section', () => {
  const rows = slipRows(
    { plies, deck_cards: [card(2, 'held', '2026-10-14', 1)] },
    '2026-10-14',
  );
  expect(rows?.[0]).toMatchObject({ lit: 2, chip: 'Tonight', tone: 'held' });
  expect(slipRows({ plies }, '2026-10-14')).toBeUndefined();
});
