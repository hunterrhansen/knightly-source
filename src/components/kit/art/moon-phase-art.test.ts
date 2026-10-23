import { moonPhaseForNight } from './moon-phase-art';

// The rule from docs/specs/2026-10-13-today-daily-review-design.md (Moon
// phases): night N waxes through a weekly cycle, full on nights 7, 14, 21.
test('the streak moon is new with no streak, full every seventh night and new again after', () => {
  expect(moonPhaseForNight(0)).toBe(0);
  expect([1, 2, 3, 4, 5, 6, 7].map(moonPhaseForNight)).toEqual([
    1, 2, 3, 4, 5, 6, 7,
  ]);
  expect([8, 13, 14, 15, 21, 22].map(moonPhaseForNight)).toEqual([
    1, 6, 7, 1, 7, 1,
  ]);
});

test('a done day whose night an older server did not send shows the full moon', () => {
  expect(moonPhaseForNight(undefined)).toBe(7);
  expect(moonPhaseForNight(null)).toBe(7);
});
