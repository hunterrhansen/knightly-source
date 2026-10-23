export type Bezier = readonly [number, number, number, number];

/** A CSS-style cubic bezier easing, evaluated on the UI thread. */
export function cubic(t: number, b: Bezier) {
  'worklet';
  const [x1, y1, x2, y2] = b;
  const at = (a1: number, a2: number, s: number) =>
    3 * a1 * s * (1 - s) ** 2 + 3 * a2 * s ** 2 * (1 - s) + s ** 3;
  // Solve x(s) = t by bisection; 14 steps is well under a pixel on a board.
  let lo = 0;
  let hi = 1;
  let s = t;
  for (let i = 0; i < 14; i++) {
    s = (lo + hi) / 2;
    if (at(x1, x2, s) < t) lo = s;
    else hi = s;
  }
  return at(y1, y2, s);
}
