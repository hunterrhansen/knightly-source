import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GameDetail } from '../../lib/api/review-contract';
import type { LoadLines } from './review-lines';
import { ReviewLayout } from './review-screen';
import { ReviewSession } from './review-session';

// A finished game review ends with the same beats as a lesson: when its
// answers carried the learner to a new rank, the rank-up follows Results.
// Whether a session crossed a threshold is `sessionEnd`'s (session-end.test.ts);
// this proves the review's end passes it on.

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
// The today feature's reminders reach the native notifications bridge.
jest.mock('../today/reminder-notifications', () => ({
  remindersSupported: false,
  requestReminderPermission: async () => false,
  replaceReminders: async () => {},
  cancelReminders: async () => {},
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const game: GameDetail = {
  id: 7,
  white: 'Player',
  black: 'Opponent',
  color: 'white',
  analysed: true,
  start_fen: null,
  san: ['e4'],
  reviewed_at: '2026-10-18T20:00:00Z',
  review_marks: [],
  accuracy: 80,
  deck_plies: [],
  plies: [],
} as unknown as GameDetail;

const rankUp = {
  rank: 'Squire I',
  key: 'squire-1',
  stars: 10,
  nextRank: 'Squire II',
  nextPost: 6,
};

const loadLines = Object.assign(async () => [], {
  key: ['engine-lines'],
  peek: () => undefined,
}) as unknown as LoadLines;

function renderFinished(end: Parameters<typeof ReviewLayout>[0]['end']) {
  const session = new ReviewSession({} as never, 7, () => true);
  const state = {
    ...session.getSnapshot(),
    game,
    phase: 'complete' as const,
    stage: 'review' as const,
  };
  const onExit = jest.fn();
  render(
    <ReviewLayout
      session={session}
      state={state}
      onExit={onExit}
      loadLines={loadLines}
      end={end}
    />,
  );
  return onExit;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(5000);
  });

test('a review whose answers reached a new rank ends on the rank-up beat', async () => {
  const onExit = renderFinished({ streak: null, mastered: 1, rankUp });
  await settle();
  expect(screen.getByText('Review complete')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('header', { name: 'Squire I' })).toBeTruthy();
  expect(screen.getByText('New rank')).toBeTruthy();
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onExit).toHaveBeenCalledTimes(1);
});

test('a review that reached no new rank shows no rank-up', async () => {
  renderFinished({ streak: null, mastered: 0, rankUp: null });
  await settle();
  expect(screen.getByText('Review complete')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  expect(screen.queryByText('New rank')).toBeNull();
});
