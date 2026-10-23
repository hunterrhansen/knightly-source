import type { PieceSymbol } from 'chess.js';

// Owned Knightly geometry, migrated as data so every platform renders the same art.
// Source and MIT notice: assets/licenses/README.md.
export type Shape =
  | Readonly<{ type: 'path'; d: string }>
  | Readonly<{
      type: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
    }>
  | Readonly<{ type: 'circle'; cx: number; cy: number; r: number }>;

export const pieceBodies: Record<PieceSymbol, readonly Shape[]> = {
  p: [
    { type: 'path', d: 'M34 79 C34 64 40 56 50 51 C60 56 66 64 66 79 Z' },
    { type: 'rect', x: 37, y: 44, width: 26, height: 9, rx: 4.5 },
    { type: 'circle', cx: 50, cy: 30, r: 13 },
  ],
  r: [
    { type: 'path', d: 'M31 79 L34 44 H66 L69 79 Z' },
    {
      type: 'path',
      d: 'M27 18 H37 V25 H45 V18 H55 V25 H63 V18 H73 V40 Q73 44 69 44 H31 Q27 44 27 40 Z',
    },
  ],
  n: [
    {
      type: 'path',
      d: 'M30 79 H72 C72 60 70 46 64 36 C59 27 52 21 44 19 L45 10 L37 16 C29 19 22 28 18 39 L15 50 C17 57 26 58 30 53 L39 46 C41 54 36 64 30 79 Z',
    },
  ],
  b: [
    { type: 'path', d: 'M37 66 C37 72 33 76 29 79 H71 C67 76 63 72 63 66 Z' },
    { type: 'rect', x: 35, y: 58, width: 30, height: 9, rx: 4.5 },
    { type: 'path', d: 'M50 19 C35 30 33 46 40 58 H60 C67 46 65 30 50 19 Z' },
    { type: 'circle', cx: 50, cy: 13, r: 6.5 },
  ],
  q: [
    { type: 'path', d: 'M34 69 C34 74 29 77 26 79 H74 C71 77 66 74 66 69 Z' },
    { type: 'rect', x: 31, y: 61, width: 38, height: 9, rx: 4.5 },
    {
      type: 'path',
      d: 'M22 30 L33 61 H67 L78 30 L63 46 L58 22 L50 44 L42 22 L37 46 Z',
    },
    { type: 'circle', cx: 22, cy: 27, r: 5.5 },
    { type: 'circle', cx: 42, cy: 19, r: 5.5 },
    { type: 'circle', cx: 58, cy: 19, r: 5.5 },
    { type: 'circle', cx: 78, cy: 27, r: 5.5 },
  ],
  k: [
    { type: 'path', d: 'M35 69 C35 74 30 77 27 79 H73 C70 77 65 74 65 69 Z' },
    { type: 'rect', x: 32, y: 61, width: 36, height: 9, rx: 4.5 },
    {
      type: 'path',
      d: 'M27 40 C27 30 37 26 50 32 C63 26 73 30 73 40 C73 50 66 55 64 61 H36 C34 55 27 50 27 40 Z',
    },
    { type: 'rect', x: 46, y: 6, width: 8, height: 24, rx: 3 },
    { type: 'rect', x: 39, y: 12, width: 22, height: 8, rx: 3 },
  ],
};

export const pieceDetails: Partial<Record<PieceSymbol, string>> = {
  r: 'M36 58 H64',
  n: 'M50 24 C58 30 63 42 64 56',
  b: 'M56 30 L46 44',
};
