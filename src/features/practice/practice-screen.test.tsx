import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { Deck } from '../../lib/api/practice-contract';
import { PracticeLayout } from './practice-screen';
import { PracticeSession } from './practice-session';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
    // A lesson in progress puts its close button in the iOS header's toolbar.
    Toolbar: Object.assign(() => null, { Button: () => null }),
  },
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));
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

// A finished extra watch: one of the learner's moves held.
const finished: Deck = {
  server_day: '2026-10-14',
  total: 3,
  mastered: 0,
  learning: 2,
  new: 1,
  today: { done: 11, total: 11 },
  lesson: { done: 10, total: 10 },
  card: null,
  results: [
    {
      game_id: 2,
      ply: 4,
      correct: true,
      mark: 'found',
      san: 'g5',
      opponent: 'kd_88',
    },
  ],
  extra: { done: 1, total: 1, kept: 1 },
};
// What the session's end read from Today: the streak as if it had grown.
const streak = {
  from: 12,
  to: 13,
  day: '2026-10-14',
  week: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-10-${12 + i}`,
    state: i < 3 ? ('done' as const) : ('upcoming' as const),
  })),
};

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
afterEach(() => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
});

async function finishedSession() {
  const api = {
    deck: jest.fn(async () => finished),
    extraWatch: jest.fn(async () => finished),
    answerLine: jest.fn(),
    lineHint: jest.fn(),
    puzzleAnswer: jest.fn(),
    puzzleHint: jest.fn(),
    unannouncedAnswer: jest.fn(),
    threatAnswer: jest.fn(),
  };
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    undefined,
    undefined,
    undefined,
    'extra',
  );
  await session.load();
  return session;
}

test('an extra watch ends over the wall and with its results, never the streak beat', async () => {
  const session = await finishedSession();
  const done = jest.fn();
  render(
    <PracticeLayout
      session={session}
      state={session.getSnapshot()}
      onExit={done}
      extra
      watch
      end={{ streak }}
    />,
  );
  await act(async () => {});
  // The end-of-watch beat: the raid turned back.
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await act(async () => {});
  expect(
    screen.getByRole('header', { name: 'Extra watch complete' }),
  ).toBeTruthy();
  // Results are the last beat: Done goes home, with no "Night 13 kept".
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(done).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/kept/i)).toBeNull();
});

// A watch's mixed-review puzzle: an earlier post's idea, unannounced.
const reviewing: Deck = {
  server_day: '2026-10-14',
  total: 0,
  mastered: 0,
  learning: 0,
  new: 0,
  today: { done: 0, total: 0 },
  lesson: { done: 4, total: 10 },
  card: null,
  results: [],
  mode: 'review',
  puzzle: {
    id: 'abc12',
    fen_prev: 'r4rk1/6pp/8/6N1/2Q5/8/6PP/6K1 b - - 0 1',
    prev_uci: 'g8h8',
    fen_before: 'r4r1k/6pp/8/6N1/2Q5/8/6PP/6K1 w - - 1 2',
    color: 'white',
    themes: ['fork'],
    rating: 1350,
    line_key: 'fedcba9876543210',
  },
};

test('tapping a badge explains it in the coach bubble, and tapping again puts the prompt back', async () => {
  const api = {
    deck: jest.fn(async () => reviewing),
    extraWatch: jest.fn(),
    answerLine: jest.fn(),
    lineHint: jest.fn(),
    puzzleAnswer: jest.fn(),
    puzzleHint: jest.fn(),
    unannouncedAnswer: jest.fn(),
    threatAnswer: jest.fn(),
  };
  const session = new PracticeSession(api, () => true);
  await session.load();
  render(
    <PracticeLayout
      session={session}
      state={session.getSnapshot()}
      onExit={jest.fn()}
      watch
    />,
  );
  await act(async () => {});
  // From the wall, the badge is the treeline's plaque.
  const badge = screen.getByRole('button', { name: 'Mixed review' });
  // The badge says it is mixed review and nothing about which idea.
  expect(screen.queryByText(/post you.ve passed/)).toBeNull();
  fireEvent.press(badge);
  expect(screen.getByText(/post you.ve passed, not named/)).toBeTruthy();
  expect(screen.queryByText(/fork/i)).toBeNull();
  fireEvent.press(badge);
  expect(screen.queryByText(/post you.ve passed/)).toBeNull();
});

test('a deck with a lesson to introduce shows the knight’s intro first, and Skip marks it seen and opens the item', async () => {
  const intro = {
    lesson: 'double-attack',
    name: 'Double attack',
    example: {
      fen_prev: 'r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1',
      prev_uci: 'e8d8',
      fen_before: 'r2k4/8/8/1N6/8/8/8/4K3 w - - 1 2',
      color: 'white' as const,
      line: ['b5c7'],
      line_key: 'fedcba9876543210',
    },
    guided: null,
  };
  const api = {
    deck: jest.fn(async () => ({ ...reviewing, intro })),
    extraWatch: jest.fn(),
    answerLine: jest.fn(),
    lineHint: jest.fn(),
    puzzleAnswer: jest.fn(),
    puzzleHint: jest.fn(),
    unannouncedAnswer: jest.fn(),
    threatAnswer: jest.fn(),
    lessonIntroduced: jest.fn(async () => ({ introduced: true })),
  };
  const session = new PracticeSession(api, () => true);
  await session.load();
  render(
    <PracticeLayout
      session={session}
      state={session.getSnapshot()}
      onExit={jest.fn()}
      watch
    />,
  );
  await act(async () => {});
  // The knight explains first; the item's badge waits.
  expect(screen.getByText('Double attack')).toBeTruthy();
  expect(screen.getByText(/One move, two threats/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Mixed review' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  await act(async () => {});
  expect(api.lessonIntroduced).toHaveBeenCalledWith('double-attack');
  // Tonight's item follows, with its own badge.
  expect(screen.getByRole('button', { name: 'Mixed review' })).toBeTruthy();
  expect(screen.queryByText(/One move, two threats/)).toBeNull();
});
