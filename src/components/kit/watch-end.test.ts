import { lanternLevel } from './watch-end';

// The watch's end (docs/specs/2026-10-18-watch-story-design.md, Session
// end): the lantern brightens one step per held move.

test('each held move brightens the lantern a step, and more held moves end brighter', () => {
  for (const held of [1, 3, 5, 9]) {
    const levels = Array.from({ length: held + 1 }, (_, step) =>
      lanternLevel(step, held),
    );
    for (let step = 1; step <= held; step++)
      expect(levels[step]).toBeGreaterThan(levels[step - 1] ?? 1);
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels[held]).toBeLessThanOrEqual(1);
  }
  expect(lanternLevel(3, 3)).toBeGreaterThan(lanternLevel(1, 1));
  // Never brighter than full, and no steps beyond the moves held.
  expect(lanternLevel(9, 9)).toBe(1);
  expect(lanternLevel(5, 2)).toBe(lanternLevel(2, 2));
});
