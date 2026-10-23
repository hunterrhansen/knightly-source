import { sessionTime } from './session-beats';

test('session time reads as minutes and seconds', () => {
  expect(sessionTime(252_400)).toEqual({
    value: '4:12',
    spoken: '4 minutes 12 seconds',
  });
  expect(sessionTime(45_000)).toEqual({ value: '0:45', spoken: '45 seconds' });
});
