import { fireEvent, render, screen } from '@testing-library/react-native';
import { todaySamples } from './today-samples';
import { TodayScreen } from './today-screen';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ canGoBack: () => true }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
const actions = () => ({
  open: jest.fn(),
  connectGames: jest.fn(),
  retry: jest.fn(),
});

test('daily practice and the latest game review open directly from home', () => {
  const act = actions();
  render(<TodayScreen state={todaySamples.Ready} actions={act} />);
  fireEvent.press(screen.getByRole('button', { name: 'Start practice' }));
  expect(act.open).toHaveBeenLastCalledWith('/practice?mode=lesson');
  fireEvent.press(
    screen.getByRole('button', { name: 'Review your latest game' }),
  );
  expect(act.open).toHaveBeenLastCalledWith('/review/42');
  expect(screen.queryByTestId('home-path')).toBeNull();
});

test('an unfinished daily session continues and a completed session offers the remaining review', () => {
  const act = actions();
  const view = render(
    <TodayScreen state={todaySamples.Returning} actions={act} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Continue practice' }));
  expect(act.open).toHaveBeenLastCalledWith('/practice?mode=lesson');
  view.rerender(<TodayScreen state={todaySamples.Done} actions={act} />);
  expect(screen.getByText('Your results are saved')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Review your game' }));
  expect(act.open).toHaveBeenLastCalledWith('/review/42');
});

test('new accounts can connect games and failed loading can retry', () => {
  const act = actions();
  const view = render(<TodayScreen state={todaySamples.New} actions={act} />);
  fireEvent.press(screen.getByRole('button', { name: 'Connect your games' }));
  expect(act.connectGames).toHaveBeenCalledTimes(1);
  view.rerender(
    <TodayScreen
      state={{ kind: 'error', message: 'Connection lost' }}
      actions={act}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(act.retry).toHaveBeenCalledTimes(1);
});
