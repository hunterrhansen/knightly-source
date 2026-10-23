import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { StrictMode } from 'react';
import { Text } from 'react-native';
import { Button } from '../../components/ui/button';
import { SessionBoundary, useSessionScope } from './session-boundary';

function Private() {
  const { identity, signOut, scope } = useSessionScope();
  return (
    <>
      <Text>{identity.userId}</Text>
      <Button onPress={() => void scope.api.me()}>Check account</Button>
      <Button onPress={() => void signOut()}>Sign out</Button>
    </>
  );
}
afterEach(() => jest.restoreAllMocks());

const a = {
  apiOrigin: 'https://api.example',
  userId: 'account-a',
  sessionId: 'a',
};
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
function CachedPrivate() {
  const { scope, signOut } = useSessionScope();
  const query = useQuery({
    queryKey: scope.meKey,
    queryFn: ({ signal }) => scope.api.me(signal),
  });
  return (
    <>
      <Text>
        {query.data
          ? `Accounts: ${query.data.limits.max_accounts}`
          : 'Loading account'}
      </Text>
      {query.error && <Text>Could not refresh</Text>}
      <Button onPress={() => void signOut()}>Sign out</Button>
    </>
  );
}
test('relaunch restores account data before refresh finishes and keeps it after refresh fails', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        admin: false,
        limits: { history_months: null, max_analysed: null, max_accounts: 4 },
      }),
    ),
  );
  const props = {
    identity: a,
    getToken: async () => 'a',
    signOut: async () => {},
  };
  const view = render(
    <SessionBoundary {...props}>
      <CachedPrivate />
    </SessionBoundary>,
  );
  await screen.findByText('Accounts: 4');
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  view.unmount();
  let reject!: (error: Error) => void;
  fetcher.mockImplementation(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  const relaunched = render(
    <SessionBoundary {...props}>
      <CachedPrivate />
    </SessionBoundary>,
  );
  await screen.findByText('Accounts: 4');
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  await act(async () => reject(new Error('offline')));
  await screen.findByText('Could not refresh');
  expect(screen.getByText('Accounts: 4')).toBeTruthy();
  relaunched.unmount();
  fetcher.mockImplementation(() => new Promise(() => {}));
  const offlineRelaunch = render(
    <SessionBoundary {...props}>
      <CachedPrivate />
    </SessionBoundary>,
  );
  await screen.findByText('Accounts: 4');
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  offlineRelaunch.unmount();
});
test('sign-out removes disk data and signing back in cannot restore it', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        admin: false,
        limits: { history_months: null, max_analysed: null, max_accounts: 4 },
      }),
    ),
  );
  const signOut = jest.fn(async () => {});
  const props = { identity: a, getToken: async () => 'a', signOut };
  const view = render(
    <SessionBoundary {...props}>
      <CachedPrivate />
    </SessionBoundary>,
  );
  await screen.findByText('Accounts: 4');
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  view.unmount();
  fetcher.mockImplementation(() => new Promise(() => {}));
  render(
    <SessionBoundary {...props}>
      <CachedPrivate />
    </SessionBoundary>,
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  await screen.findByText('Loading account');
  expect(screen.queryByText('Accounts: 4')).toBeNull();
});
test('account replacement removes the previous snapshot before restoring the next account', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        admin: false,
        limits: { history_months: null, max_analysed: null, max_accounts: 4 },
      }),
    ),
  );
  const view = render(
    <SessionBoundary
      identity={a}
      getToken={async () => 'a'}
      signOut={async () => {}}
    >
      <CachedPrivate />
    </SessionBoundary>,
  );
  await screen.findByText('Accounts: 4');
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  fetcher.mockImplementation(() => new Promise(() => {}));
  view.rerender(
    <SessionBoundary
      identity={{ ...a, userId: 'b', sessionId: 'b' }}
      getToken={async () => 'b'}
      signOut={async () => {}}
    >
      <CachedPrivate />
    </SessionBoundary>,
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Accounts: 4')).toBeNull();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  view.unmount();
});
test('account replacement hides old identity and Strict Mode permits current authenticated requests', async () => {
  const requests: Request[] = [];
  const fetcher = jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input) => {
      requests.push(new Request(input));
      return new Response(
        JSON.stringify({
          admin: false,
          limits: { history_months: null, max_analysed: null, max_accounts: 4 },
        }),
      );
    });
  const view = render(
    <StrictMode>
      <SessionBoundary
        identity={a}
        getToken={async () => 'a'}
        signOut={async () => {}}
      >
        <Private />
      </SessionBoundary>
    </StrictMode>,
  );
  await screen.findByText('account-a');
  fireEvent.press(screen.getByRole('button', { name: 'Check account' }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]?.headers.get('Authorization')).toBe('Bearer a');
  view.rerender(
    <StrictMode>
      <SessionBoundary
        identity={{ ...a, userId: 'account-b', sessionId: 'b' }}
        getToken={async () => 'b'}
        signOut={async () => {}}
      >
        <Private />
      </SessionBoundary>
    </StrictMode>,
  );
  expect(screen.queryByText('account-a')).toBeNull();
  await screen.findByText('account-b');
  fireEvent.press(screen.getByRole('button', { name: 'Check account' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1]?.headers.get('Authorization')).toBe('Bearer b');
  view.unmount();
  fetcher.mockRestore();
});
test('sign-out failure hides private content and offers explicit recovery', async () => {
  render(
    <SessionBoundary
      identity={a}
      getToken={async () => 'a'}
      signOut={async () => {
        throw new Error('offline');
      }}
    >
      <Private />
    </SessionBoundary>,
  );
  await screen.findByText('account-a');
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.queryByText('account-a')).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Retry sign out' })).toBeTruthy(),
  );
  expect(screen.queryByText('account-a')).toBeNull();
});
