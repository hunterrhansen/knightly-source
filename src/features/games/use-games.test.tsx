import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { useState } from 'react';
import { AppState, Text } from 'react-native';
import type { GameFilters } from '../../lib/api/progress-contract';
import { SessionBoundary } from '../../lib/auth/session-boundary';
import { Button } from '../../ui';
import { useGameLibrary, useImportProgress } from './use-games';

const originalAppState = AppState.currentState;

function ImportReader({ label }: { label: string }) {
  const { progress } = useImportProgress();
  return <Button onPress={() => void progress.refetch()}>{label}</Button>;
}
function GamesReader() {
  const library = useGameLibrary({});
  const total = library.data?.pages[0]?.total;
  return (
    <Text>{total === undefined ? 'Loading games' : `${total} games`}</Text>
  );
}
function LibraryReader() {
  const [filters, setFilters] = useState<GameFilters>({ rated: 'all' });
  const library = useGameLibrary(filters);
  return (
    <>
      <Text>
        {library.data?.pages
          .flatMap((page) => page.games.map((game) => game.opponent))
          .join(', ') ?? 'Loading library'}
      </Text>
      <Button onPress={() => void library.fetchNextPage()}>
        Load older games
      </Button>
      <Button
        onPress={() => setFilters({ rated: 'all', review_status: 'reviewed' })}
      >
        Reviewed games
      </Button>
    </>
  );
}
afterEach(() => {
  AppState.currentState = originalAppState;
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test('multiple screens keep loaded games until import changes, then refresh them once', async () => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  let total = 1;
  let gamesRequests = 0;
  let importRequests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const path = new URL(new Request(input).url).pathname;
    if (path === '/api/onboarding') {
      importRequests++;
      return new Response(
        JSON.stringify({
          accounts: [],
          games: total,
          analysed: total,
          target: total,
          working: true,
          step: null,
          summary: {
            blunders: 0,
            mistakes: 0,
            misses: 0,
            positions: 0,
            pattern: null,
          },
          findings: [],
        }),
      );
    }
    if (path === '/api/status')
      return new Response(
        JSON.stringify({ queued: [], current_run: null, last_run: null }),
      );
    if (path === '/api/games') {
      gamesRequests++;
      return new Response(
        JSON.stringify({ total, page: 1, page_size: 20, games: [] }),
      );
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = render(
    <SessionBoundary
      identity={{
        apiOrigin: 'https://api.example',
        userId: 'a',
        sessionId: 'a',
      }}
      getToken={async () => 'a'}
      signOut={async () => {}}
    >
      <ImportReader label="Refresh Today" />
      <ImportReader label="Refresh Progress" />
      <GamesReader />
    </SessionBoundary>,
  );
  await screen.findByText('1 games');
  await act(async () => {});
  expect(gamesRequests).toBe(1);
  await act(async () => jest.advanceTimersByTimeAsync(3000));
  expect(importRequests).toBeGreaterThan(1);
  expect(gamesRequests).toBe(1);
  fireEvent.press(screen.getByRole('button', { name: 'Refresh Today' }));
  await act(async () => {});
  expect(gamesRequests).toBe(1);
  total = 2;
  fireEvent.press(screen.getByRole('button', { name: 'Refresh Progress' }));
  await screen.findByText('2 games');
  await waitFor(() => expect(gamesRequests).toBe(2));
  view.unmount();
  await act(async () => jest.advanceTimersByTimeAsync(1000));
});

test('appending older games retains history and changing review scope starts a fresh collection', async () => {
  const requests: URL[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = new URL(new Request(input).url);
    requests.push(url);
    const reviewed = url.searchParams.get('review_status') === 'reviewed';
    const page = Number(url.searchParams.get('page'));
    return new Response(
      JSON.stringify({
        total: reviewed ? 1 : 2,
        page,
        page_size: 1,
        games: [
          {
            id: reviewed ? 3 : page,
            opponent: reviewed
              ? 'Reviewed opponent'
              : page === 1
                ? 'Newest opponent'
                : 'Older opponent',
            played_at: null,
            speed: 'rapid',
            outcome: 'win',
            analysed: true,
          },
        ],
      }),
    );
  });
  const view = render(
    <SessionBoundary
      identity={{
        apiOrigin: 'https://api.example',
        userId: 'a',
        sessionId: 'a',
      }}
      getToken={async () => 'a'}
      signOut={async () => {}}
    >
      <LibraryReader />
    </SessionBoundary>,
  );
  await screen.findByText('Newest opponent');
  fireEvent.press(screen.getByRole('button', { name: 'Load older games' }));
  await screen.findByText('Newest opponent, Older opponent');
  expect(requests.map((url) => url.searchParams.get('page'))).toEqual([
    '1',
    '2',
  ]);
  fireEvent.press(screen.getByRole('button', { name: 'Reviewed games' }));
  await screen.findByText('Reviewed opponent');
  expect(screen.queryByText('Newest opponent, Older opponent')).toBeNull();
  expect(requests[2]?.searchParams.get('page')).toBe('1');
  expect(requests[2]?.searchParams.get('review_status')).toBe('reviewed');
  expect(requests[2]?.searchParams.get('unrated')).toBe('true');
  view.unmount();
});
