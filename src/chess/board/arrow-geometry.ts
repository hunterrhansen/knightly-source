import type { Color, Square } from 'chess.js';
import { indexOf } from '../coordinates';

// Measured from Chess.com's board arrows, in squares: the shaft leaves the
// origin's centre 0.36 out (clear of the piece), is 0.22 wide, and ends in a
// 0.36-long, 0.52-wide head whose tip is the destination's centre.
const START = 0.36;
const SHAFT = 0.11;
const HEAD = 0.36;
const HEAD_HALF = 0.26;

type Point = { x: number; y: number };
const at = (p: Point, d: Point, length: number): Point => ({
  x: p.x + d.x * length,
  y: p.y + d.y * length,
});
const unit = (from: Point, to: Point): Point => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};
/** The left-hand normal of a direction. */
const normal = (d: Point): Point => ({ x: -d.y, y: d.x });
const round = (n: number) => Math.round(n * 10_000) / 10_000;
const format = (points: Point[]) =>
  points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');

/**
 * One closed outline for an arrow, in square units (an 8 × 8 viewBox), so a
 * translucent fill never darkens where a shaft and head would overlap.
 * Two-by-one offsets bend into an L along the longer axis first.
 */
export function arrowGeometry(from: Square, to: Square, orientation: Color) {
  const origin = indexOf(from, orientation);
  const destination = indexOf(to, orientation);
  const start = { x: (origin % 8) + 0.5, y: Math.floor(origin / 8) + 0.5 };
  const tip = {
    x: (destination % 8) + 0.5,
    y: Math.floor(destination / 8) + 0.5,
  };
  const horizontal = Math.abs(tip.x - start.x);
  const vertical = Math.abs(tip.y - start.y);
  if (!horizontal && !vertical) return undefined;
  const knight =
    (horizontal === 2 && vertical === 1) ||
    (horizontal === 1 && vertical === 2);
  const corner = knight
    ? horizontal > vertical
      ? { x: tip.x, y: start.y }
      : { x: start.x, y: tip.y }
    : undefined;
  const first = unit(start, corner ?? tip);
  const last = corner ? unit(corner, tip) : first;
  const n1 = normal(first);
  const n2 = normal(last);
  const tail = at(start, first, START);
  const base = at(tip, last, -HEAD);
  const side = (sign: 1 | -1) => {
    const out: Point[] = [at(tail, n1, sign * SHAFT)];
    // The legs meet at right angles: each side's mitre is on both offsets.
    if (corner)
      out.push({
        x: corner.x + sign * SHAFT * (n1.x + n2.x),
        y: corner.y + sign * SHAFT * (n1.y + n2.y),
      });
    out.push(at(base, n2, sign * SHAFT), at(base, n2, sign * HEAD_HALF));
    return out;
  };
  return {
    points: format([...side(1), tip, ...side(-1).reverse()]),
  };
}
