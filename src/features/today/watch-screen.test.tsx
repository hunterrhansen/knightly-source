import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { DailyReview } from '../../lib/api/today-contract';
import { SessionBoundary } from '../../lib/auth/session-boundary';
import { WatchAskBeat } from './watch-ask-beat';
import { WatchScreen } from './watch-screen';

const mockRouter = {
  back: jest.fn(),
  canGoBack: () => true,
  replace: jest.fn(),
};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useRouter: () => mockRouter,
  Stack: { Screen: () => null },
}));
const mockPermission = jest.fn(async () => true);
jest.mock('./reminder-notifications', () => ({
  remindersSupported: true,
  requestReminderPermission: () => mockPermission(),
  replaceReminders: async () => {},
  cancelReminders: async () => {},
}));

const today: DailyReview = {
  day: '2026-10-18',
  day_ends_at: '2026-10-19T06:00:00Z',
  plan: [],
  streak: {
    count: 0,
    best: 0,
    freezes: 0,
    safe_today: false,
    last_kept: null,
    week: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${12 + i}`,
      state: 'none' as const,
    })),
  },
  lesson: { done: 0, total: 0 },
  memory: { total: 0, mastered: 0, learning: 0, new: 0 },
  learn_more: 0,
  tomorrow_due: 0,
  game: null,
  new_games: 0,
  watch: null,
  puzzles: { theme: null, share: null },
};

/** Serves Today without a watch; records each save and answers it with `reply`. */
function serve(reply: (body: { time: string; anchor: string }) => Response) {
  const saves: unknown[] = [];
  global.fetch = jest.fn(async (input) => {
    const request = new Request(input);
    if (request.method === 'PUT') {
      const body = await request.json();
      saves.push([new URL(request.url).pathname, body]);
      return reply(body);
    }
    return new Response(JSON.stringify({ today }));
  });
  return saves;
}
const acknowledge = (body: { time: string; anchor: string }) =>
  new Response(JSON.stringify({ ...body, set_on: '2026-10-18' }));

let view: ReturnType<typeof render> | undefined;
function mount(content: React.ReactNode = <WatchScreen />) {
  view = render(
    <SessionBoundary
      identity={{
        apiOrigin: 'https://api.example',
        userId: 'A',
        sessionId: 'A',
      }}
      getToken={async () => 'token'}
      signOut={async () => {}}
    >
      {content}
    </SessionBoundary>,
  );
}

const original = global.fetch;
// Fake timers, so the session's cached queries don't keep Jest running.
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  view?.unmount();
  view = undefined;
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  global.fetch = original;
  jest.clearAllMocks();
});

test('saves the chosen time and habit, then asks for notification permission', async () => {
  const saves = serve(acknowledge);
  mount();
  // Evening is preselected.
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: /8:00 PM/ }).props.accessibilityState,
    ).toMatchObject({ checked: true }),
  );
  fireEvent.press(screen.getByRole('radio', { name: /9:00 PM/ }));
  fireEvent.press(screen.getByText('finish dinner'));
  expect(mockPermission).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Keep my watch'));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(saves).toEqual([
    ['/api/settings/watch', { time: '21:00', anchor: 'finish dinner' }],
  ]);
  expect(mockPermission).toHaveBeenCalledTimes(1);
});

test('a habit typed with its own “After I” is saved without it', async () => {
  const saves = serve(acknowledge);
  mount();
  fireEvent.changeText(
    await screen.findByLabelText('The habit your watch follows'),
    '  After I  walk the dog. ',
  );
  fireEvent.press(screen.getByText('Keep my watch'));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(saves).toEqual([
    ['/api/settings/watch', { time: '20:00', anchor: 'walk the dog' }],
  ]);
});

test('a failed save stays on the screen and asks for nothing', async () => {
  const saves = serve(() => new Response('{}', { status: 500 }));
  mount();
  fireEvent.press(await screen.findByText('get into bed'));
  fireEvent.press(screen.getByText('Keep my watch'));
  await screen.findByText('Couldn’t save your watch');
  expect(saves).toHaveLength(1);
  expect(mockPermission).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('after the first watch, the ask starts from when it was kept and continues once saved', async () => {
  const saves = serve(acknowledge);
  const next = jest.fn();
  mount(
    <WatchAskBeat
      keptAt={new Date(2026, 9, 18, 20, 40)}
      day="2026-10-18"
      next={next}
    />,
  );
  expect(
    screen.getByRole('header', { name: 'Same time tomorrow?' }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: /8:45 PM/ }).props.accessibilityState,
    ).toMatchObject({ checked: true }),
  );
  fireEvent.press(screen.getByText('finish dinner'));
  fireEvent.press(screen.getByText('Keep my watch'));
  await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  expect(saves).toEqual([
    ['/api/settings/watch', { time: '20:45', anchor: 'finish dinner' }],
  ]);
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('Not now continues without saving or asking for notifications', async () => {
  const saves = serve(acknowledge);
  const next = jest.fn();
  mount(
    <WatchAskBeat
      keptAt={new Date(2026, 9, 18, 20, 40)}
      day="2026-10-18"
      next={next}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: /8:45 PM/ }).props.accessibilityState,
    ).toMatchObject({ checked: true }),
  );
  // The skip is recorded on this device as the beats move on.
  await act(async () => fireEvent.press(screen.getByText('Not now')));
  expect(next).toHaveBeenCalledTimes(1);
  expect(saves).toEqual([]);
  expect(mockPermission).not.toHaveBeenCalled();
});
