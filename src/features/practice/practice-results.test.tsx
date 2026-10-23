import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import type { Deck } from '../../lib/api/practice-contract';
import { practiceResults, raidsTurnedBack } from './practice-results';

const result = (ply: number, mark: Deck['results'][number]['mark']) => ({
  game_id: 7,
  ply,
  correct: mark !== 'missed',
  mark,
  san: `N${ply}`,
  opponent: 'Rival',
});

test('practice results name each saved answer as review does, never by its raw mark', () => {
  const deck = {
    results: [result(10, 'helped'), result(12, 'missed'), result(14, 'good')],
    puzzle_results: [{ id: 'p1', correct: false, rating: 1500, themes: [] }],
  } as unknown as Deck;
  render(<View>{practiceResults(deck, undefined).details}</View>);
  expect(screen.getByText('With help')).toBeTruthy();
  // A missed position comes back; a missed puzzle does not.
  expect(screen.getByText('To revisit')).toBeTruthy();
  expect(screen.getByText('Good move')).toBeTruthy();
  expect(screen.getByText('Missed')).toBeTruthy();
  expect(screen.queryByText('helped')).toBeNull();
});

test('the raids turned back at the watch’s end are tonight’s moves held, not puzzles', () => {
  const deck = {
    results: [
      result(10, 'found'),
      result(12, 'missed'),
      result(14, 'good'),
      result(16, 'missed'),
    ],
    puzzle_results: [{ id: 'p1', correct: true, rating: 1500, themes: [] }],
  } as unknown as Deck;
  expect(raidsTurnedBack(deck)).toBe(2);
  expect(raidsTurnedBack({ results: [] })).toBe(0);
});
