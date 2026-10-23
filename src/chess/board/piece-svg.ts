import type { Color, PieceSymbol } from 'chess.js';
import { tokens } from '../../theme/tokens';
import { cburnettPieces } from './cburnett-art';
import { pieceBodies, pieceDetails, type Shape } from './piece-art';

const shapeMarkup = (shape: Shape) => {
  switch (shape.type) {
    case 'path':
      return `<path d="${shape.d}"/>`;
    case 'rect':
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.rx}"/>`;
    case 'circle':
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
  }
};

/** The Knightly piece as SVG markup, matching `Piece`'s Knightly set. */
function knightlySvg(kind: PieceSymbol, color: Color) {
  const palette = tokens.pieces;
  const white = color === 'w';
  const fill = white ? palette.white : palette.black;
  const shade = white ? palette.whiteShade : palette.blackShade;
  const outline = white ? palette.outline : palette.blackOutline;
  const stroke = `stroke="${outline}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;
  const eye =
    kind === 'n'
      ? `<circle cx="35" cy="31" r="3.6" fill="${white ? outline : palette.blackEye}"/>`
      : '';
  const detail = pieceDetails[kind]
    ? `<path d="${pieceDetails[kind]}" fill="none" stroke="${white ? shade : palette.blackDetail}" stroke-width="4" stroke-linecap="round"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="20" y="79" width="60" height="13" rx="6.5" ${stroke} fill="${shade}"/><g ${stroke} fill="${fill}">${pieceBodies[kind].map(shapeMarkup).join('')}</g>${eye}${detail}</svg>`;
}

/** The piece artwork sets the board can draw. */
export type PieceSet = 'knightly' | 'cburnett';

/**
 * Piece art as SVG markup for canvas renderers.
 */
export function pieceSvg(
  kind: PieceSymbol,
  color: Color,
  set: PieceSet,
): string {
  return set === 'cburnett'
    ? cburnettPieces[color][kind]
    : knightlySvg(kind, color);
}
