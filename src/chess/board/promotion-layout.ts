import type { Color, Square } from 'chess.js';
import { indexOf } from '../coordinates';
import type { Promotion } from './board.types';

/** The first eligible piece occupies the destination; choices extend inward. */
export function promotionLayout(
  square: Square,
  orientation: Color,
  size: number,
  eligible: readonly Promotion[],
) {
  const choices = (['q', 'n', 'r', 'b'] as const).filter((piece) =>
    eligible.includes(piece),
  );
  const targetSize = Math.max(44, size / 8);
  const cancelSize = 44;
  const contentHeight = choices.length * targetSize + cancelSize;
  const height = Math.min(size, contentHeight);
  const index = indexOf(square, orientation);
  const fromBottom = Math.floor(index / 8) === 7;
  return {
    choices,
    targetSize,
    cancelSize,
    height,
    contentHeight,
    fromBottom,
    left: Math.max(0, Math.min(((index % 8) * size) / 8, size - targetSize)),
    top: fromBottom ? Math.max(0, size - height) : 0,
  };
}
