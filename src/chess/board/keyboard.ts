import type { Color, Square } from 'chess.js';
import { indexOf, squareAt } from '../coordinates';

export function keyboardDestination(
  square: Square,
  key: string,
  orientation: Color,
  control: boolean,
): Square {
  const index = indexOf(square, orientation);
  const row = Math.floor(index / 8);
  const column = index % 8;
  switch (key) {
    case 'ArrowLeft':
      return squareAt(row * 8 + Math.max(0, column - 1), orientation);
    case 'ArrowRight':
      return squareAt(row * 8 + Math.min(7, column + 1), orientation);
    case 'ArrowUp':
      return squareAt(Math.max(0, row - 1) * 8 + column, orientation);
    case 'ArrowDown':
      return squareAt(Math.min(7, row + 1) * 8 + column, orientation);
    case 'Home':
      return squareAt(control ? 0 : row * 8, orientation);
    case 'End':
      return squareAt(control ? 63 : row * 8 + 7, orientation);
    default:
      return square;
  }
}
