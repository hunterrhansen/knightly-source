import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { useState } from 'react';
import { AppState, Text } from 'react-native';
import type { ProgressRange } from '../../lib/api/progress-contract';
import { SessionBoundary } from '../../lib/auth/session-boundary';
import { Button } from '../../ui';
import { useImportProgress } from '../games/games-api';
import { useHabit, useProgressRange } from './use-progress';

function ImportProbe() {
  useImportProgress();
  return <Probe />;
}
function Probe() {
  const [range, setRange] = useState<ProgressRange>('90d');
  const { overview, patterns } = useProgressRange(range);
  const { recent } = useHabit();
  return (
    <>
      <Text>
        {range}: {overview.data?.rating.current ?? 'Loading'}
      </Text>
      <Text>
        {patterns.error
          ? 'Tactics unavailable'
          : `Tactics: ${patterns.data?.pending ?? 'Loading'}`}
      </Text>
      <Text>Last 30 days: {recent.data?.rating.current ?? 'Loading'}</Text>
      <Button onPress={() => setRange('30d')}>30 days</Button>
      <Button onPress={() => void patterns.refetch()}>Retry tactics</Button>
    </>
  );
}
const identity = {
  apiOrigin: 'https://api.example',
  userId: 'a',
  sessionId: 'a',
};
function Page({
  user = 'a',
  importing = false,
}: {
  user?: string;
  importing?: boolean;
}) {
  return (
    <SessionBoundary
      identity={{ ...identity, userId: user, sessionId: user }}
      getToken={async () => user}
      signOut={async () => {}}
    >
      {importing ? <ImportProbe /> : <Probe />}
    </SessionBoundary>
  );
}
function response(range: string, current: number) {
  return new Response(
    JSON.stringify({
      range,
      rating: { current, change: 0, best: current },
      games_played: 1,
      games_analysed: 0,
      games_per_week: 1,
      rating_series: [],
      kpis: {
        blunders_per_game: null,
        conversion: null,
        punish_rate: null,
        comeback_rate: null,
        accuracy: null,
        opening_edge: null,
        analysed: 0,
      },
      previous_kpis: null,
      top_openings: [],
    }),
  );
}
const originalAppState = AppState.currentState;
beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
});
afterEach(() => {
  AppState.currentState = originalAppState;
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test('a late old-period response cannot replace the selected period; tactics retry preserves loaded ratings and the last 30 days', async () => {
  let oldResponse!: (value: Response) => void;
  let failPatterns = true;
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = new URL(new Request(input).url);
    if (url.pathname === '/api/overview') {
      if (url.searchParams.get('range') === '90d')
        return new Promise((resolve) => {
          oldResponse = resolve;
        });
      return response('30d', 920);
    }
    if (url.pathname === '/api/patterns')
      return failPatterns
        ? new Response('{}', { status: 503 })
        : new Response(
            JSON.stringify({
              range: url.searchParams.get('range'),
              patterns: [],
              pending: 2,
            }),
          );
    return new Response(JSON.stringify({ days: [] }));
  });
  const view = render(<Page />);
  await screen.findByText('Last 30 days: 920');
  await screen.findByText('Tactics unavailable');
  fireEvent.press(screen.getByRole('button', { name: '30 days' }));
  await screen.findByText('30d: 920');
  await act(async () => oldResponse(response('90d', 800)));
  expect(screen.getByText('30d: 920')).toBeTruthy();
  failPatterns = false;
  fireEvent.press(screen.getByRole('button', { name: 'Retry tactics' }));
  await screen.findByText('Tactics: 2');
  expect(screen.getByText('30d: 920')).toBeTruthy();
  expect(screen.getByText('Last 30 days: 920')).toBeTruthy();
  view.unmount();
});
test('replacing an account hides its loaded progress and rejects its late summary', async () => {
  let pendingA!: (value: Response) => void;
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const request = new Request(input);
    const url = new URL(request.url);
    if (url.pathname === '/api/overview') {
      if (url.searchParams.get('range') === '30d') return response('30d', 0);
      requests++;
      if (request.headers.get('Authorization') === 'Bearer a')
        return new Promise((resolve) => {
          pendingA = resolve;
        });
      return response('90d', 1100);
    }
    if (url.pathname === '/api/patterns')
      return new Response(
        JSON.stringify({
          range: '90d',
          patterns: [],
          pending: request.headers.get('Authorization') === 'Bearer a' ? 4 : 0,
        }),
      );
    return new Response(JSON.stringify({ days: [] }));
  });
  const view = render(<Page />);
  await screen.findByText('Tactics: 4');
  view.rerender(<Page user="b" />);
  expect(screen.queryByText('Tactics: 4')).toBeNull();
  await screen.findByText('90d: 1100');
  await act(async () => pendingA(response('90d', 800)));
  await waitFor(() => expect(requests).toBe(2));
  expect(screen.queryByText('90d: 800')).toBeNull();
  expect(screen.getByText('Tactics: 0')).toBeTruthy();
  view.unmount();
});

test('unchanged import polls preserve loaded ratings without another summary request; new analysis refreshes them', async () => {
  let analysed = 0;
  let working = true;
  let ratingsRequests = 0;
  let importRequests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = new URL(new Request(input).url);
    if (url.pathname === '/api/overview') {
      ratingsRequests++;
      return response('90d', analysed ? 930 : 920);
    }
    if (url.pathname === '/api/onboarding') {
      importRequests++;
      return new Response(
        JSON.stringify({
          accounts: [],
          games: 1,
          analysed,
          target: 1,
          working,
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
    if (url.pathname === '/api/status')
      return new Response(
        JSON.stringify({ queued: [], current_run: null, last_run: null }),
      );
    if (url.pathname === '/api/patterns')
      return new Response(
        JSON.stringify({ range: '90d', patterns: [], pending: 0 }),
      );
    return new Response(JSON.stringify({ days: [] }));
  });
  const view = render(<Page importing />);
  await screen.findByText('90d: 920');
  const loadedRequests = ratingsRequests;
  const loadedImportRequests = importRequests;
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() =>
    expect(importRequests).toBeGreaterThan(loadedImportRequests),
  );
  expect(ratingsRequests).toBe(loadedRequests);
  expect(screen.getByText('90d: 920')).toBeTruthy();
  analysed = 1;
  working = false;
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await screen.findByText('90d: 930');
  const completedRequests = ratingsRequests;
  const completedImportRequests = importRequests;
  await act(async () => {
    jest.advanceTimersByTime(9000);
  });
  expect(ratingsRequests).toBe(completedRequests);
  expect(importRequests).toBe(completedImportRequests);
  view.unmount();
});
