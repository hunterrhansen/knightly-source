import { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HideCard } from './hide-card';

const mockSuspend = jest.fn();
const mockUnsuspend = jest.fn();
const mockClient = new QueryClient();
jest.mock('../../lib/auth/session-boundary', () => ({
  useSessionScope: () => ({
    scope: {
      meKey: ['account', 'me'],
      queryClient: mockClient,
      isCurrent: () => true,
      api: { suspendCard: mockSuspend, unsuspendCard: mockUnsuspend },
    },
  }),
}));

beforeEach(() => {
  mockSuspend.mockReset().mockResolvedValue({ suspended: true });
  mockUnsuspend.mockReset().mockResolvedValue({ suspended: false });
});

test('hiding saves the chosen reason, and Undo shows the position again', async () => {
  render(<HideCard gameId={7} ply={9} />);
  fireEvent.press(screen.getByText('Don’t show this again'));
  fireEvent.press(screen.getByText('The engine is wrong'));
  expect(await screen.findByText(/Hidden\. It won’t come back/)).toBeTruthy();
  expect(mockSuspend).toHaveBeenCalledWith(7, 9, 'engine_wrong');
  fireEvent.press(screen.getByText('Undo'));
  expect(await screen.findByText('Don’t show this again')).toBeTruthy();
  expect(mockUnsuspend).toHaveBeenCalledWith(7, 9);
});

test('a failed save keeps the position and says so', async () => {
  mockSuspend.mockRejectedValue(new Error('offline'));
  render(<HideCard gameId={7} ply={9} />);
  fireEvent.press(screen.getByText('Don’t show this again'));
  fireEvent.press(screen.getByText('Not useful to me'));
  expect(await screen.findByText(/Couldn’t save that/)).toBeTruthy();
  expect(screen.queryByText(/Hidden\. It won’t come back/)).toBeNull();
});
