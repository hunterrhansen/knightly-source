import { type SkImage, Skia } from '@shopify/react-native-skia';
import type { Color, PieceSymbol } from 'chess.js';
import { PixelRatio } from 'react-native';
import { tokens } from '../../../theme/tokens';
import { PIECE_FILL } from '../geometry';
import { type PieceSet, pieceSvg } from '../piece-svg';

/** The 12 piece images in one texture, for the layered board's single draw:
 * kinds across, white then black down, each `cell` pixels square. */
type PieceAtlas = Readonly<{
  image: SkImage;
  cell: number;
  pixelRatio: number;
}>;

const KINDS: readonly PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const COLORS: readonly Color[] = ['w', 'b'];
/** Pieces fill 96% of their square, as on the classic board. */

/** The atlas cell holding a piece: its top-left corner in texture pixels. */
export function atlasCell(atlas: PieceAtlas, color: Color, kind: PieceSymbol) {
  return {
    x: KINDS.indexOf(kind) * atlas.cell,
    y: COLORS.indexOf(color) * atlas.cell,
  };
}

// A board size seldom changes; a few entries cover rotations and lab boards.
const cache = new Map<string, PieceAtlas>();
const CACHE_SIZE = 6;

/** Rasterizes a vector piece set once per size and pixel ratio. */
export function pieceAtlas(
  set: PieceSet,
  squareSize: number,
): PieceAtlas | undefined {
  if (squareSize <= 0) return undefined;
  const pixelRatio = PixelRatio.get();
  // Rasterized for the largest size a piece is drawn at: a carried piece is
  // twice life size, so a resting one samples the cell two to one.
  const cell = Math.ceil(
    squareSize * PIECE_FILL * pixelRatio * tokens.motion.grabScale,
  );
  const key = `${set}:${cell}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const surface = Skia.Surface.MakeOffscreen(
    cell * KINDS.length,
    cell * COLORS.length,
  );
  if (!surface) return undefined;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  for (const [row, color] of COLORS.entries())
    for (const [column, kind] of KINDS.entries()) {
      const svg = Skia.SVG.MakeFromString(pieceSvg(kind, color, set));
      if (!svg) continue;
      canvas.save();
      canvas.translate(column * cell, row * cell);
      canvas.drawSvg(svg, cell, cell);
      canvas.restore();
    }
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const atlas = {
    image: snapshot.makeNonTextureImage() ?? snapshot,
    cell,
    pixelRatio,
  };
  cache.set(key, atlas);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return atlas;
}
