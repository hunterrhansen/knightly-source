import { parseReturnRoute } from '../../lib/auth/return-route';
import { EXTRA_WATCH_HREF } from '../practice/practice-api';
import { isDestinationAvailable } from './destinations';

test('the path, its modals and the routes they open stay reachable after sign-in', () => {
  expect(isDestinationAvailable('/')).toBe(true);
  expect(isDestinationAvailable('/games')).toBe(true);
  expect(isDestinationAvailable('/games/7')).toBe(true);
  expect(isDestinationAvailable('/progress')).toBe(true);
  expect(isDestinationAvailable('/progress/hidden')).toBe(true);
  // All stats is part of Progress now.
  expect(isDestinationAvailable('/progress/stats')).toBe(false);
  expect(isDestinationAvailable('/account')).toBe(true);
  expect(isDestinationAvailable('/practice')).toBe(true);
  expect(isDestinationAvailable('/review/7')).toBe(true);
  expect(isDestinationAvailable('/review/not-a-game')).toBe(false);
});

test('tonight’s watch is available with its validated query, the old daily plan is not', () => {
  expect(isDestinationAvailable('/practice?mode=lesson')).toBe(true);
  expect(isDestinationAvailable('/daily')).toBe(false);
});

test('the path’s extra watch link opens practice in extra mode and survives sign-in', () => {
  expect(EXTRA_WATCH_HREF).toBe('/practice?mode=extra');
  expect(isDestinationAvailable(EXTRA_WATCH_HREF)).toBe(true);
  expect(parseReturnRoute(EXTRA_WATCH_HREF)).toBe(EXTRA_WATCH_HREF);
});
