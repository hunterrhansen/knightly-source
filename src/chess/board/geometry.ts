import { tokens } from '../../theme/tokens';

/** Share of a square a piece's artwork fills. */
export const PIECE_FILL = 0.96;
/** Pointer travel, in points, that turns a press into a drag instead of a tap. */
export const DRAG_THRESHOLD = 8;

/** How far past an edge, in squares, the board's renderers draw: a carried
 * piece leans over the border instead of being held inside it. */
export const BOARD_OVERHANG = 0.5;

/**
 * Where a carried piece is drawn, in points: centred on the finger, raised so
 * its base rests there, and free to lean one overhang past the board's edge.
 */
export function grabCenter(
  cell: number,
  x: number,
  y: number,
): { x: number; y: number } {
  'worklet';
  const reach =
    ((cell * PIECE_FILL * tokens.motion.grabScale) / 2) *
    tokens.motion.grabArtShare;
  const inset = reach - cell * BOARD_OVERHANG;
  return {
    x: Math.min(Math.max(x, inset), cell * 8 - inset),
    y: Math.max(y - cell * tokens.motion.grabRise, inset),
  };
}
