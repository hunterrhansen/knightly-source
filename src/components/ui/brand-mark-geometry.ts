// Knight-and-moon geometry in a 100-unit box, shared by the in-app marks and
// `scripts/generate-brand.mjs`, so the app icon and native splash match the app.
export const knightPath =
  'M30 88 L74 88 Q78 88 77 84 L72 66 Q81 54 80 40 Q78 21 60 12 L57 6 Q55 3 52 6 L48 13 Q41 14 35 19 L21 37 Q17 43 21 47 L26 52 Q30 55 35 52 L44 46 Q49 45 48 50 Q45 60 36 68 Q29 75 30 84 Z';
export const knightTransform = { x: 6, y: 18, scale: 0.7 };
export const knightEye = { cx: 41, cy: 38, r: 2.7 };
export const moon = { cx: 72, cy: 27, r: 13 };
// Drawn in the square's color over the moon to leave a crescent.
export const moonCutout = { cx: 78.5, cy: 22, r: 11 };
/**
 * The tile is a 2×2 board split at (50, 48): the top-right and bottom-left
 * squares are the darker green, so the moon sits on a dark square and the
 * knight's eye on a light one. Paths cover the rounded tile (x 4–96, y 4–92,
 * corner radius 22).
 */
export const boardSplit = { x: 50, y: 48 };
export const tileDarkSquares = [
  'M50 4 H74 A22 22 0 0 1 96 26 V48 H50 Z',
  'M4 48 H50 V92 H26 A22 22 0 0 1 4 70 Z',
];
