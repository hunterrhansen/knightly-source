import type { Color, Square } from 'chess.js';

// Worklets: gestures and animations call these on the display thread too.
export function squareAt(index: number, orientation: Color): Square {
  'worklet';
  if (!Number.isInteger(index) || index < 0 || index > 63) {
    throw new RangeError('Board index must be an integer from 0 to 63');
  }
  const offset = orientation === 'w' ? index : 63 - index;
  return `${String.fromCharCode(97 + (offset % 8))}${8 - Math.floor(offset / 8)}` as Square;
}

export function indexOf(square: Square, orientation: Color): number {
  'worklet';
  const index = (8 - Number(square[1])) * 8 + square.charCodeAt(0) - 97;
  return orientation === 'w' ? index : 63 - index;
}

/** Top-left corner of `square` on a board of `cell`-sized squares. */
export function squareOrigin(
  square: Square,
  orientation: Color,
  cell: number,
): { x: number; y: number } {
  'worklet';
  const index = indexOf(square, orientation);
  return { x: (index % 8) * cell, y: Math.floor(index / 8) * cell };
}

export function squareFromPoint(
  x: number,
  y: number,
  width: number,
  orientation: Color,
): Square | null {
  'worklet';
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    width <= 0 ||
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= width
  )
    return null;
  return squareAt(
    Math.floor(y / (width / 8)) * 8 + Math.floor(x / (width / 8)),
    orientation,
  );
}
