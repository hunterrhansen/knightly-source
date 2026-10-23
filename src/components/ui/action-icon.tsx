import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export type ActionIconName =
  | 'hint'
  | 'review'
  | 'back'
  | 'previous'
  | 'next'
  | 'retry'
  | 'solution'
  | 'forward'
  | 'best'
  | 'share'
  | 'list'
  | 'close'
  | 'first'
  | 'last'
  | 'flip'
  | 'check'
  | 'clock'
  | 'up'
  | 'down'
  | 'board';

const glyphs: Record<ActionIconName, React.ReactNode> = {
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  hint: (
    <Path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3Z" />
  ),
  review: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-4-4" />
    </>
  ),
  back: <Path d="m15 18-6-6 6-6" />,
  previous: <Path d="m15 18-6-6 6-6" />,
  next: <Path d="m9 18 6-6-6-6" />,
  retry: <Path d="M4 12a8 8 0 1 0 2.3-5.7L4 8m0-5v5h5" />,
  solution: (
    <>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  forward: <Path d="M5 12h14m-6-6 6 6-6 6" />,
  best: (
    <Path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" />
  ),
  share: (
    <>
      <Circle cx={18} cy={5} r={2.5} />
      <Circle cx={6} cy={12} r={2.5} />
      <Circle cx={18} cy={19} r={2.5} />
      <Path d="m8.2 10.8 7.6-4.4m-7.6 6.8 7.6 4.4" />
    </>
  ),
  list: <Path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  first: <Path d="M6 5v14m12-1-6-6 6-6" />,
  last: <Path d="M18 5v14M6 6l6 6-6 6" />,
  flip: <Path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" />,
  up: <Path d="M12 19V6m-6 6 6-6 6 6" />,
  down: <Path d="M12 5v13m-6-6 6 6 6-6" />,
  // A small board, for steps that open a game rather than count positions.
  board: (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={3} />
      <Path d="M3 12h18M12 3v18" />
      <Rect x={3} y={3} width={9} height={9} rx={1} fill="currentColor" />
      <Rect x={12} y={12} width={9} height={9} rx={1} fill="currentColor" />
    </>
  ),
};

const outline = '#24211c'; // tokens.pieces.outline
/** The outline's width beyond the stroke, and its lower-right drop. */
const OUTLINE = 1.7;
const DROP = { x: 0.5, y: 0.8 };
/** The 24-unit glyphs sit on the 28-unit grid, leaving room for the outline. */
const GRID = 28;
const PAD = (GRID - 24) / 2;

/** Dark ink is its own outline: an outline under it only blurs the shape. */
const needsOutline = (color: string) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return true;
  const linear = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(0) + 0.7152 * linear(2) + 0.0722 * linear(4) > 0.15;
};

/**
 * Decorative icons in the glyphs' chunky cel: each stroke in `color` over a
 * warm outline that drops to the lower right, like the ledge under a control.
 * Dark ink draws plain, since it already reads as the outline.
 * `size` is the glyph's box; the outline overhangs it without moving layout.
 * The owning control carries the accessible name.
 */
export function ActionIcon({
  name,
  color,
  size = 24,
  strokeWidth = 2,
}: {
  name: ActionIconName;
  color: string;
  size?: number;
  /** Heavier strokes for small inline marks (2.6 at 18 points). */
  strokeWidth?: number;
}) {
  const box = (size * GRID) / 24;
  const overhang = (size * PAD) / 24;
  const glyph = glyphs[name];
  const outlined = needsOutline(color);
  return (
    <Svg
      width={box}
      height={box}
      viewBox={`${-PAD} ${-PAD} ${GRID} ${GRID}`}
      style={{ margin: -overhang }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {outlined && (
        <>
          <G
            color={outline}
            stroke={outline}
            strokeWidth={strokeWidth + OUTLINE}
            transform={`translate(${DROP.x} ${DROP.y})`}
          >
            {glyph}
          </G>
          <G
            color={outline}
            stroke={outline}
            strokeWidth={strokeWidth + OUTLINE}
          >
            {glyph}
          </G>
        </>
      )}
      <G color={color} stroke={color} strokeWidth={strokeWidth}>
        {glyph}
      </G>
    </Svg>
  );
}
