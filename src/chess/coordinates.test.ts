import type { Color, Square } from 'chess.js';
import { indexOf, squareAt, squareFromPoint } from './coordinates';

test('pointer geometry uses current orientation and rejects outside or zero layout', () => {
  expect(squareFromPoint(180, 260, 320, 'w')).toBe('e2');
  expect(squareFromPoint(140, 60, 320, 'b')).toBe('e2');
  for (const [x, y, width] of [
    [-1, 10, 320],
    [320, 10, 320],
    [10, 320, 320],
    [10, -1, 320],
    [0, 0, 0],
    [NaN, 10, 320],
  ]) {
    expect(squareFromPoint(x ?? 0, y ?? 0, width ?? 0, 'w')).toBeNull();
  }
});

describe('displayed board coordinates', () => {
  test('white orientation starts at a8 and places e2 at index 52', () => {
    expect(squareAt(0, 'w')).toBe('a8');
    expect(squareAt(63, 'w')).toBe('h1');
    expect(indexOf('e2', 'w')).toBe(52);
  });
  test('black orientation starts at h1 and rotates both axes', () => {
    expect(squareAt(0, 'b')).toBe('h1');
    expect(squareAt(63, 'b')).toBe('a8');
    expect(indexOf('e2', 'b')).toBe(11);
  });
  test.each<Color>(['w', 'b'])(
    'every square round-trips in %s orientation',
    (orientation) => {
      const squares = new Set<Square>();
      for (let index = 0; index < 64; index += 1) {
        const square = squareAt(index, orientation);
        squares.add(square);
        expect(indexOf(square, orientation)).toBe(index);
      }
      expect(squares.size).toBe(64);
    },
  );
  test.each([-1, 64, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid index %s',
    (index) => {
      expect(() => squareAt(index, 'w')).toThrow(
        'Board index must be an integer from 0 to 63',
      );
    },
  );
});
