import { cubic } from './easing';

test('the layered board eases moves along the same curves as the classic board', () => {
  // Endpoints are exact and a linear curve stays linear.
  for (const curve of [
    [0, 0, 1, 1],
    [0.25, 0.1, 0.25, 1],
    [0.5, 0, 0.2, 1],
  ] as const) {
    expect(cubic(0, curve)).toBeCloseTo(0, 3);
    expect(cubic(1, curve)).toBeCloseTo(1, 3);
  }
  expect(cubic(0.5, [0, 0, 1, 1])).toBeCloseTo(0.5, 3);
  // CSS "ease" (0.25, 0.1, 0.25, 1) is about 0.8024 halfway.
  expect(cubic(0.5, [0.25, 0.1, 0.25, 1])).toBeCloseTo(0.8024, 2);
  // An overshooting curve (the Arcade style) passes 1 before settling.
  expect(cubic(0.6, [0.34, 1.56, 0.64, 1])).toBeGreaterThan(1);
});
