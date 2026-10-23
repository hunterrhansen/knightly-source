import { squareAt } from '../coordinates';
import { keyboardDestination } from './keyboard';

test.each(['w', 'b'] as const)(
  'keyboard respects displayed edges in %s orientation',
  (orientation) => {
    for (let index = 0; index < 64; index++) {
      const square = squareAt(index, orientation);
      const left = keyboardDestination(square, 'ArrowLeft', orientation, false);
      const right = keyboardDestination(
        square,
        'ArrowRight',
        orientation,
        false,
      );
      if (index % 8 > 0)
        expect(
          keyboardDestination(left, 'ArrowRight', orientation, false),
        ).toBe(square);
      else expect(left).toBe(square);
      if (index % 8 < 7)
        expect(
          keyboardDestination(right, 'ArrowLeft', orientation, false),
        ).toBe(square);
      else expect(right).toBe(square);
      expect(keyboardDestination(square, 'Home', orientation, false)).toBe(
        squareAt(Math.floor(index / 8) * 8, orientation),
      );
      expect(keyboardDestination(square, 'End', orientation, false)).toBe(
        squareAt(Math.floor(index / 8) * 8 + 7, orientation),
      );
      expect(keyboardDestination(square, 'ArrowUp', orientation, false)).toBe(
        squareAt(Math.max(index % 8, index - 8), orientation),
      );
      expect(keyboardDestination(square, 'ArrowDown', orientation, false)).toBe(
        squareAt(Math.min(56 + (index % 8), index + 8), orientation),
      );
    }
  },
);
test('Control Home/End use displayed board endpoints', () => {
  expect(keyboardDestination('e2', 'Home', 'b', true)).toBe('h1');
  expect(keyboardDestination('e2', 'End', 'w', true)).toBe('h1');
  expect(keyboardDestination('a8', 'ArrowLeft', 'w', false)).toBe('a8');
  expect(keyboardDestination('e2', 'Tab', 'w', false)).toBe('e2');
});
