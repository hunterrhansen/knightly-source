import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { SessionBoundary } from '../../lib/auth/session-boundary';
import { ConnectGamesScreen } from './connect-games-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true }),
  Stack: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
const empty = {
  accounts: [],
  games: 0,
  analysed: 0,
  target: 0,
  working: false,
  step: null,
  findings: [],
  summary: { blunders: 0, mistakes: 0, misses: 0, positions: 0, pattern: null },
};
test('requires profile confirmation and can resume a queued import', async () => {
  jest.useFakeTimers();
  const original = global.fetch;
  let connected = false;
  const writes: string[] = [];
  global.fetch = jest.fn(async (input) => {
    const request = new Request(input);
    const url = new URL(request.url);
    if (request.method === 'POST') {
      writes.push(await request.text());
      connected = true;
      return new Response(
        JSON.stringify({ source: 'chesscom', handle: 'GGHansen' }),
      );
    }
    const data =
      url.pathname === '/api/lookup'
        ? {
            source: 'chesscom',
            handle: 'GGHansen',
            rating: 914,
            rating_kind: 'Rapid',
            games: 20,
            since: null,
          }
        : url.pathname === '/api/status'
          ? {
              queued: connected ? ['update'] : [],
              current_run: null,
              last_run: null,
            }
          : {
              ...empty,
              accounts: connected
                ? [{ source: 'chesscom', handle: 'GGHansen' }]
                : [],
              working: connected,
            };
    return new Response(JSON.stringify(data));
  });
  const mount = () =>
    render(
      <SessionBoundary
        identity={{
          apiOrigin: 'https://api.example',
          userId: 'A',
          sessionId: 'A',
        }}
        getToken={async () => 'token'}
        signOut={async () => {}}
      >
        <ConnectGamesScreen />
      </SessionBoundary>,
    );
  let view = mount();
  try {
    await waitFor(() =>
      expect(screen.getByLabelText('Chess.com username')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByLabelText('Chess.com username'),
      'gghansen',
    );
    fireEvent.press(screen.getByText('Find account'));
    await waitFor(() =>
      expect(screen.getByText('Is this your account?')).toBeTruthy(),
    );
    expect(writes).toHaveLength(0);
    fireEvent.press(screen.getByText('Yes, import my games'));
    await waitFor(() =>
      expect(screen.getByText('Bringing in your games…')).toBeTruthy(),
    );
    expect(writes).toEqual([
      JSON.stringify({ source: 'chesscom', handle: 'GGHansen' }),
    ]);
    view.unmount();
    view = mount();
    await screen.findByText('Bringing in your games…');
    expect(screen.queryByLabelText('Chess.com username')).toBeNull();
    expect(writes).toHaveLength(1);
  } finally {
    view.unmount();
    global.fetch = original;
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  }
});
