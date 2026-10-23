import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Dispatch, SetStateAction } from 'react';
import { SessionBoundary } from '../../lib/auth/session-boundary';
import { GamesScreen } from './games-screen';
import type { GamesViewProps } from './games-view';

let mockApplyRoute: Dispatch<
  SetStateAction<Record<string, string | undefined>>
>;
const mockRouter = { setParams: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => {
    const React = require('react');
    const [params, setParams] = React.useState({
      range: '30d',
      kpi: 'blunders',
      color: 'black',
      q: 'London',
    });
    mockApplyRoute = setParams;
    return params;
  },
  useRouter: () => mockRouter,
}));
jest.mock('./games-view', () => ({
  GamesView: (props: GamesViewProps) => {
    const { TextInput, Text, Pressable, View } = require('react-native');
    return (
      <View>
        <TextInput
          accessibilityLabel="Search"
          value={props.search}
          onChangeText={props.onSearch}
        />
        <Text>{JSON.stringify(props.filters)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open game"
          onPress={() => props.onOpenGame(7)}
        />
      </View>
    );
  },
}));
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  mockRouter.setParams.mockClear();
  mockRouter.push.mockClear();
});

test('a delayed search route update preserves newer typing and the Progress filter context', async () => {
  jest.useFakeTimers();
  const onOpenGame = jest.fn();
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const path = new URL(new Request(input).url).pathname;
    const response =
      path === '/api/games'
        ? { total: 0, page: 1, page_size: 50, games: [] }
        : path === '/api/status'
          ? { queued: [], current_run: null, last_run: null }
          : {
              accounts: [],
              games: 0,
              analysed: 0,
              target: 0,
              working: false,
              step: null,
              findings: [],
              summary: {
                blunders: 0,
                mistakes: 0,
                misses: 0,
                positions: 0,
                pattern: null,
              },
            };
    return new Response(JSON.stringify(response));
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
      <GamesScreen
        onOpenGame={onOpenGame}
        onAccounts={jest.fn()}
        onClose={jest.fn()}
      />
    </SessionBoundary>,
  );
  await screen.findByLabelText('Search');
  fireEvent.changeText(screen.getByLabelText('Search'), 'London System');
  await act(async () => jest.advanceTimersByTimeAsync(300));
  const first = mockRouter.setParams.mock.calls[0]?.[0];
  expect(first).toMatchObject({
    q: 'London System',
    range: '30d',
    kpi: 'blunders',
    color: 'black',
    rated: 'rated',
  });
  fireEvent.changeText(screen.getByLabelText('Search'), 'London System new');
  await act(async () => mockApplyRoute(first));
  expect(screen.getByLabelText('Search').props.value).toBe('London System new');
  await act(async () => jest.advanceTimersByTimeAsync(300));
  expect(mockRouter.setParams).toHaveBeenLastCalledWith(
    expect.objectContaining({
      q: 'London System new',
      range: '30d',
      kpi: 'blunders',
      color: 'black',
    }),
  );
  // A game opens inside the Games modal (the route pushes /games/7).
  fireEvent.press(screen.getByRole('button', { name: 'Open game' }));
  expect(onOpenGame).toHaveBeenCalledWith(7);
  view.unmount();
});
