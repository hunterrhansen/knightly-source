import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useConnectionForm } from './use-connection-form';

const mockLookup = jest.fn();
const mockConnect = jest.fn();
let mockCurrent = true;
let mockClient: QueryClient;
jest.mock('../../lib/auth/session-boundary', () => ({
  useSessionScope: () => ({
    scope: {
      meKey: ['account', 'test'],
      api: { lookup: mockLookup, connect: mockConnect },
      isCurrent: () => mockCurrent,
      queryClient: mockClient,
    },
  }),
}));
function setup() {
  mockClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={mockClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => useConnectionForm({ disabled: false, onBusyChange: jest.fn() }),
    { wrapper },
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockCurrent = true;
  mockLookup.mockResolvedValue({ handle: 'confirmed-player', games: 12 });
  mockConnect.mockResolvedValue(undefined);
});
afterEach(() => mockClient.clear());
test('invalid usernames cannot trigger a public account lookup', () => {
  const { result } = setup();
  act(() => result.current.setHandle('https://chess.com/member/player'));
  act(() => result.current.findAccount());
  expect(result.current.message).toBe('Enter a username, not a profile URL.');
  expect(mockLookup).not.toHaveBeenCalled();
  expect(mockConnect).not.toHaveBeenCalled();
});
test('finding a profile does not import it, and duplicate confirmations import only once', async () => {
  let finish!: () => void;
  mockConnect.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = setup();
  act(() => result.current.setHandle('player'));
  act(() => result.current.findAccount());
  await waitFor(() =>
    expect(result.current.lookup.data?.handle).toBe('confirmed-player'),
  );
  expect(mockConnect).not.toHaveBeenCalled();
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.confirm();
    void result.current.confirm();
  });
  expect(mockConnect).toHaveBeenCalledTimes(1);
  expect(mockConnect).toHaveBeenCalledWith(
    'confirmed-player',
    undefined,
    'chesscom',
  );
  await act(async () => {
    finish();
    await pending;
  });
});
test('changing accounts before confirmation prevents importing the previous profile', async () => {
  const { result } = setup();
  act(() => result.current.setHandle('player'));
  act(() => result.current.findAccount());
  await waitFor(() =>
    expect(result.current.lookup.data?.handle).toBe('confirmed-player'),
  );
  mockCurrent = false;
  await act(async () => {
    await result.current.confirm();
  });
  expect(mockConnect).not.toHaveBeenCalled();
});
