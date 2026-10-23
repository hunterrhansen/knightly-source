import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import {
  AuthProvider,
  localDevAuthEnabled,
  useFoundation,
} from './auth-provider';
import { useSessionScope } from './session-boundary';

let mockAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: 'a',
  sessionId: 'a',
  getToken: async () => 'a',
};
jest.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => mockAuth,
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: async () => {} }),
}));
jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: {} }));
jest.mock('../bootstrap', () => ({
  Bootstrap: ({ children }: { children: (state: unknown) => ReactNode }) =>
    children({
      phase: 'ready',
      apiOrigin: 'https://api.example',
      config: { clerk_publishable_key: 'pk_test_example', contact: null },
    }),
}));
function Private() {
  const { scope } = useSessionScope();
  const query = useQuery({
    queryKey: scope.meKey,
    queryFn: ({ signal }) => scope.api.me(signal),
  });
  return (
    <Text>
      {query.data
        ? `Limit ${query.data.limits.max_accounts}`
        : 'Loading account'}
    </Text>
  );
}
function Routes() {
  const state = useFoundation();
  return state.phase === 'signed-in' ? <Private /> : <Text>{state.phase}</Text>;
}
beforeEach(() => {
  mockAuth = {
    isLoaded: true,
    isSignedIn: true,
    userId: 'a',
    sessionId: 'a',
    getToken: async () => 'a',
  };
});
afterEach(() => jest.restoreAllMocks());
test('Clerk session expiry removes cached data before another account signs in', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        admin: false,
        limits: { history_months: null, max_analysed: null, max_accounts: 4 },
      }),
    ),
  );
  const view = render(
    <AuthProvider>
      <Routes />
    </AuthProvider>,
  );
  await screen.findByText('Limit 4');
  await waitFor(async () =>
    expect((await AsyncStorage.getAllKeys()).length).toBe(1),
  );
  mockAuth = { ...mockAuth, isSignedIn: false };
  view.rerender(
    <AuthProvider>
      <Routes />
    </AuthProvider>,
  );
  await screen.findByText('signed-out');
  await waitFor(async () =>
    expect(await AsyncStorage.getAllKeys()).toEqual([]),
  );
  fetcher.mockImplementation(() => new Promise(() => {}));
  mockAuth = {
    ...mockAuth,
    isSignedIn: true,
    userId: 'b',
    sessionId: 'b',
    getToken: async () => 'b',
  };
  view.rerender(
    <AuthProvider>
      <Routes />
    </AuthProvider>,
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Limit 4')).toBeNull();
  view.unmount();
});
test('Clerk account replacement rejects late responses from the previous session', async () => {
  let finish!: (value: Response) => void;
  let started = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    started++;
    return new Request(input).headers.get('Authorization') === 'Bearer a'
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : new Response(
          JSON.stringify({
            admin: false,
            limits: {
              history_months: null,
              max_analysed: null,
              max_accounts: 2,
            },
          }),
        );
  });
  const view = render(
    <AuthProvider>
      <Routes />
    </AuthProvider>,
  );
  await waitFor(() => expect(started).toBe(1));
  mockAuth = {
    ...mockAuth,
    userId: 'b',
    sessionId: 'b',
    getToken: async () => 'b',
  };
  view.rerender(
    <AuthProvider>
      <Routes />
    </AuthProvider>,
  );
  await screen.findByText('Limit 2');
  await act(async () =>
    finish(
      new Response(
        JSON.stringify({
          admin: false,
          limits: { history_months: null, max_analysed: null, max_accounts: 4 },
        }),
      ),
    ),
  );
  expect(screen.queryByText('Limit 4')).toBeNull();
  view.unmount();
});

test('the Clerk bypass is only available to development builds that ask for it', () => {
  expect(localDevAuthEnabled(false, 'local')).toBe(false);
  expect(localDevAuthEnabled(true, undefined)).toBe(false);
  expect(localDevAuthEnabled(true, 'clerk')).toBe(false);
  expect(localDevAuthEnabled(true, 'local')).toBe(true);
});
