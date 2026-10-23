import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useSystemReducedMotion } from './use-reduced-motion';

afterEach(() => jest.restoreAllMocks());
test('native preference query initializes reduced motion', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const { result } = renderHook(useSystemReducedMotion);
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current).toBe(true);
});
test('live native event wins over a late query and unsubscribe runs on unmount', async () => {
  let resolveQuery: (value: boolean) => void = () => {};
  let changed: (value: boolean) => void = () => {};
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    () => {},
  );
  const remove = jest.spyOn(subscription, 'remove');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveQuery = resolve;
      }),
  );
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((_event, handler) => {
      changed = handler as unknown as (value: boolean) => void;
      return subscription;
    });
  const { result, unmount } = renderHook(useSystemReducedMotion);
  act(() => changed(true));
  await act(async () => resolveQuery(false));
  expect(result.current).toBe(true);
  act(() => changed(false));
  expect(result.current).toBe(false);
  unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
