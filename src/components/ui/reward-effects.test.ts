import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { playRewardCue } from './reward-effects';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success' },
}));

beforeEach(() => jest.clearAllMocks());

test('with sounds off a reward still buzzes but plays no sound', () => {
  playRewardCue('reward', 'off');
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  expect(createAudioPlayer).not.toHaveBeenCalled();
});

test('with sounds on a reward buzzes and plays its sound together', () => {
  playRewardCue('land', 'on');
  expect(Haptics.impactAsync).toHaveBeenCalledWith('rigid');
  // Every sound's player is made up front; exactly one of them plays.
  const plays = jest
    .mocked(createAudioPlayer)
    .mock.results.reduce(
      (sum, { value }) => sum + value.play.mock.calls.length,
      0,
    );
  expect(plays).toBe(1);
});
