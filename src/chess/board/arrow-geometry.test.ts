import type { Square } from 'chess.js';
import { arrowGeometry } from './arrow-geometry';

const points = (from: Square, to: Square) =>
  arrowGeometry(from, to, 'w')
    ?.points.split(' ')
    .map((p) => p.split(',').map(Number) as [number, number]);

// Chess.com's measured proportions (in squares): the shaft starts 0.36 from the
// origin's centre and is 0.22 wide; the head is 0.36 long and 0.52 wide, its
// tip on the destination's centre.
test('a straight arrow leaves the piece and ends in a short, wide head', () => {
  expect(arrowGeometry('e2', 'e5', 'w')?.points).toBe(
    '4.61,6.14 4.61,3.86 4.76,3.86 4.5,3.5 4.24,3.86 4.39,3.86 4.39,6.14',
  );
});
test('a knight arrow is one outline with square corners at the bend', () => {
  expect(arrowGeometry('g1', 'f3', 'w')?.points).toBe(
    '6.61,7.14 6.61,5.39 5.86,5.39 5.86,5.24 5.5,5.5 5.86,5.76 5.86,5.61 6.39,5.61 6.39,7.14',
  );
});
test.each<[Square, [number, number]]>([
  ['f5', [5.5, 4.5]],
  ['f3', [5.5, 4.5]],
  ['b5', [1.5, 4.5]],
  ['b3', [1.5, 4.5]],
  ['e6', [3.5, 2.5]],
  ['c6', [3.5, 2.5]],
  ['e2', [3.5, 6.5]],
  ['c2', [3.5, 6.5]],
])('knight offset d4 to %s bends along the longer axis first', (to, bend) => {
  // Both mitre points sit diagonally 0.11 from the bend's centre.
  const mitres = points('d4', to)?.filter(
    ([x, y]) =>
      Math.abs(Math.abs(x - bend[0]) - 0.11) < 1e-6 &&
      Math.abs(Math.abs(y - bend[1]) - 0.11) < 1e-6,
  );
  expect(mitres).toHaveLength(2);
});
test('other arrows stay straight, and a same-square arrow draws nothing', () => {
  // Seven corners: two shaft edges, two head barbs a side, and the tip.
  expect(points('d4', 'f6')).toHaveLength(7);
  expect(points('d4', 'f6')?.[3]).toEqual([5.5, 2.5]);
  expect(arrowGeometry('d4', 'd4', 'w')).toBeUndefined();
});
