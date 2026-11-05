import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { SessionResults } from '../../ui';
import { SessionBeats } from './session-end-beats';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
// The watch ask's reminder switch reaches the native notifications bridge.
jest.mock('./reminder-notifications', () => ({
  remindersSupported: false,
  requestReminderPermission: async () => false,
  replaceReminders: async () => {},
  cancelReminders: async () => {},
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const results: SessionResults = {
  title: 'Practice complete',
  coach: 'Solid session.',
  stats: [
    { label: 'Found', value: '4', tone: 'brand', icon: 'check' },
    { label: 'Accuracy', value: '80%', tone: 'gold', icon: 'best' },
    {
      label: 'Time',
      value: '4:12',
      spoken: '4 minutes 12 seconds',
      tone: 'sky',
      icon: 'clock',
    },
  ],
};
const streak = {
  from: 12,
  to: 13,
  day: '2026-10-14',
  week: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-10-${12 + i}`,
    state: i < 3 ? ('done' as const) : ('upcoming' as const),
  })),
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
});

const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(5000);
  });

test('the button appears only once the beat has landed', async () => {
  const finish = jest.fn();
  render(
    <SessionBeats
      results={results}
      finish={{ label: 'Done', onPress: finish }}
    />,
  );
  await act(async () => {});
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(finish).toHaveBeenCalledTimes(1);
});

test('under reduced motion the button is available at once', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  render(
    <SessionBeats
      results={results}
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
});

test('a streak extension plays after the results, and only then finishes', async () => {
  const finish = jest.fn();
  render(
    <SessionBeats
      results={results}
      streak={streak}
      finish={{ label: 'Done', onPress: finish }}
    />,
  );
  await settle();
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('header', { name: '13 days in a row' })).toBeTruthy();
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(finish).toHaveBeenCalledTimes(1);
});

test('without an extension the results finish the session', async () => {
  render(
    <SessionBeats
      results={results}
      streak={null}
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  await settle();
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
});

test('results hold their button while the streak check is outstanding', async () => {
  const { rerender } = render(
    <SessionBeats
      results={results}
      pending
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  await settle();
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  rerender(
    <SessionBeats
      results={results}
      streak={streak}
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
});

test('each beat announces its title and values once', async () => {
  const announce = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockClear();
  const { rerender } = render(
    <SessionBeats
      results={results}
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  rerender(
    <SessionBeats
      results={results}
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  await settle();
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenCalledWith(
    'Practice complete. Found 4, Accuracy 80%, Time 4 minutes 12 seconds',
  );
});

test('the streak week starts on Sunday with the day before the summary week', async () => {
  render(
    <SessionBeats
      results={results}
      streak={{ ...streak, earlier: { '2026-10-11': 'done' } }}
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText(/October 11: Done$/)).toBeTruthy();
  expect(screen.getByLabelText(/October 17: Upcoming$/)).toBeTruthy();
  expect(screen.queryByLabelText(/October 18:/)).toBeNull();
});

const rankUp = {
  rank: 'Squire I',
  key: 'squire-1',
  stars: 10,
  nextRank: 'Squire II',
  nextPost: 6,
  latest: [
    {
      game_id: 7,
      ply: 31,
      san: 'Nf5',
      label: 'Loose piece',
      earned_on: '2026-10-14',
      dimmed: false,
    },
  ],
};

test('legacy rank and castle data do not add steps between results and the streak', async () => {
  const finish = jest.fn();
  render(
    <SessionBeats
      results={results}
      streak={streak}
      rankUp={rankUp}
      held={3}
      finish={{ label: 'Done', onPress: finish }}
    />,
  );
  expect(screen.getByText('Practice complete')).toBeTruthy();
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByText('New rank')).toBeNull();
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(finish).toHaveBeenCalledTimes(1);
});

test('without a rank-up, positions moved to long-term memory keep their own beat', async () => {
  render(
    <SessionBeats
      results={results}
      mastered={2}
      rankUp={null}
      finish={{ label: 'Done', onPress: jest.fn() }}
    />,
  );
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(
    screen.getByRole('header', {
      name: '2 positions moved to long-term memory',
    }),
  ).toBeTruthy();
  expect(screen.queryByText('New rank')).toBeNull();
});
