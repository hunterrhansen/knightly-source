import * as Haptics from 'expo-haptics';
import { answerHaptic, momentHaptic } from './haptics';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// Fake timers queue microtasks too; this runs the coalesced haptic.
const settle = () => jest.runAllTicks();

// Each test starts well clear of the last one's haptic.
let clock = 0;
beforeEach(() => {
  clock += 10_000;
  jest.useFakeTimers({ now: clock });
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

test('the last right answer of a lesson buzzes once, not once for the answer and once for the lesson', () => {
  momentHaptic('success');
  answerHaptic(true);
  settle();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
});

test('a right answer that reaches a new run tier plays the success, not a light tap as well', () => {
  momentHaptic('light');
  answerHaptic(true);
  settle();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

test('a haptic within 100 ms of the last is dropped; later answers still buzz', () => {
  answerHaptic(true);
  settle();
  jest.advanceTimersByTime(60);
  momentHaptic('success');
  settle();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000);
  answerHaptic(false);
  settle();
  expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('error');
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
});
