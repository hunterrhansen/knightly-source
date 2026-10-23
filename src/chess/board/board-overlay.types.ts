import type { Color } from 'chess.js';
import type { FastBoard } from './fast-board';
import type { PieceSet } from './piece-svg';

export type BoardOverlayProps = Readonly<{
  fast: FastBoard;
  size: number;
  orientation: Color;
  set: PieceSet;
  /** Selected-square tint. */
  selection: string;
  /** Destination dot and capture ring colour. */
  marker: string;
  /** Their opacity over the squares. */
  markerAlpha: Readonly<{ dot: number; ring: number }>;
}>;
