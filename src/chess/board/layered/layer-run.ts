import type { Color } from 'chess.js';
import type { VisualPiece } from '../transition';

/** What the piece layer drew last: its pieces, geometry and atlas. */
export type LayerRun = Readonly<{
  pieces: readonly VisualPiece[];
  orientation: Color;
  square: number;
  atlas: unknown;
}>;

/**
 * Whether a redraw starts the pieces' travel again. Travel starts once per
 * set of pieces (a position or transition); a redraw that changes only the
 * selection (tapping or lifting a piece) keeps the clock, so the last move's
 * piece never replays and nothing lands again.
 */
export function restartsTravel(
  previous: LayerRun | undefined,
  next: LayerRun,
): boolean {
  return (
    !previous ||
    previous.pieces !== next.pieces ||
    previous.orientation !== next.orientation ||
    previous.square !== next.square ||
    previous.atlas !== next.atlas
  );
}
