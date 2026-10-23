/** Items above which the bar groups them into this many segments. */
const MAX_SEGMENTS = 40;
const GROUPED = 20;
/** Items above which segments sit closer together. */
const TIGHT = 20;

export type SegmentState = {
  /** How full the segment is, 0–1 (grouped segments fill in steps). */
  fill: number;
  /** The segment holding the next item. */
  current: boolean;
};

/** The bar's segments for `done` of `total` items, `current` being the item
 * on screen: one per item, or 20 equal groups above 40 items. */
export function lessonSegments(
  done: number,
  current: number,
  total: number,
): { segments: SegmentState[]; gap: number } {
  const count = Math.max(0, Math.round(total));
  const finished = Math.max(0, Math.min(done, count));
  if (count <= MAX_SEGMENTS)
    return {
      gap: count > TIGHT ? 2 : 5,
      segments: Array.from({ length: count }, (_, i) => ({
        fill: i < finished ? 1 : 0,
        current: i === current && i >= finished,
      })),
    };
  const per = count / GROUPED;
  return {
    gap: 2,
    segments: Array.from({ length: GROUPED }, (_, i) => {
      const start = i * per;
      return {
        fill: Math.max(0, Math.min(1, (finished - start) / per)),
        current:
          current >= start && current < start + per && current >= finished,
      };
    }),
  };
}

export type RunTier = 'none' | 'gold' | 'flame';

/** The fill's colour band for a run of clean answers. */
export function runTier(combo: number): RunTier {
  return combo >= 7 ? 'flame' : combo >= 5 ? 'gold' : 'none';
}

/** "3 IN A ROW", from three clean answers; "ON FIRE" from seven. */
export function runLabel(combo: number) {
  if (combo < 3) return undefined;
  return combo >= 7 ? `${combo} IN A ROW · ON FIRE` : `${combo} IN A ROW`;
}

/** The bar as a screen reader hears it. */
export function progressLabel(done: number, total: number, combo: number) {
  if (!total) return 'No steps';
  return `${Math.min(done, total)} of ${total} done${combo >= 2 ? `, ${combo} in a row` : ''}`;
}
