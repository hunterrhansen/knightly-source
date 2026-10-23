import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PointsCounter } from './points-flight';
import { CountUp, useRewardMoment } from './reward-effects';
import { playSound } from './sounds';

jest.mock('./sounds', () => ({
  ...jest.requireActual('./sounds'),
  playSound: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Rigid: 'rigid', Soft: 'soft', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

const coins = () =>
  jest.mocked(playSound).mock.calls.filter(([sound]) => sound === 'coin');

test('a points award still lands its coin when the screen re-renders mid-flight', () => {
  // Mounted before the award, as in a session: an award present at mount is
  // a restored session and does not fly.
  const view = render(<PointsCounter points={0} />);
  view.rerender(
    <PointsCounter points={10} award={{ id: 'a1', base: 10, bonus: 0 }} />,
  );
  act(() => jest.advanceTimersByTime(300));
  // The session hands over a new award object for the same award.
  view.rerender(
    <PointsCounter points={10} award={{ id: 'a1', base: 10, bonus: 0 }} />,
  );
  act(() => jest.advanceTimersByTime(2000));
  expect(coins()).toHaveLength(1);
});

function Moment({ at }: { at: number | undefined }) {
  useRewardMoment(at, 'land');
  return null;
}

test('a reward moment plays once, even when its timing input changes afterwards', () => {
  const view = render(<Moment at={100} />);
  act(() => jest.advanceTimersByTime(200));
  view.rerender(<Moment at={undefined} />);
  view.rerender(<Moment at={100} />);
  act(() => jest.advanceTimersByTime(200));
  expect(coins()).toHaveLength(1);
});

test('a finished count shows a new total without counting or cheering again', () => {
  const done = jest.fn();
  const view = render(
    <Text>
      <CountUp to={10} onDone={done} />
    </Text>,
  );
  act(() => jest.advanceTimersByTime(2000));
  expect(done).toHaveBeenCalledTimes(1);
  view.rerender(
    <Text>
      <CountUp to={20} onDone={done} />
    </Text>,
  );
  act(() => jest.advanceTimersByTime(2000));
  expect(done).toHaveBeenCalledTimes(1);
  expect(screen.getByText('20')).toBeTruthy();
});
