import type { Patterns } from '../../lib/api/progress-contract';

/** Fewest first tries for a rate, as Lichess's dashboard requires for a clear
 * result; below it a pattern shows its count, never a percentage. */
export const MIN_ATTEMPTS = 6;
/** Failures (or first-try solves) a pattern needs before it is called weak
 * (or strong) from practice alone. */
const ENOUGH = 3;

export type PatternRow = {
  pattern: string;
  /** Your blunders, mistakes and misses in rated games carrying this tactic. */
  misses: number;
  attempts: number;
  firstTry: number;
  rate: number | null;
  previousRate: number | null;
};

const rateOf = (attempts: number, firstTry: number) =>
  attempts >= MIN_ATTEMPTS ? firstTry / attempts : null;

/** One row per tactic the server tracks, in its order. */
export function patternRows(data: Patterns): PatternRow[] {
  const misses = new Map(data.patterns.map((p) => [p.pattern, p.total]));
  return (data.strength ?? []).map((s) => ({
    pattern: s.pattern,
    misses: misses.get(s.pattern) ?? 0,
    attempts: s.attempts,
    firstTry: s.first_try,
    rate: rateOf(s.attempts, s.first_try),
    previousRate: s.previous
      ? rateOf(s.previous.attempts, s.previous.first_try)
      : null,
  }));
}

/** First-try rate over every tactic, the bar for weak and strong. */
function overallRate(rows: PatternRow[]) {
  const attempts = rows.reduce((sum, r) => sum + r.attempts, 0);
  const firstTry = rows.reduce((sum, r) => sum + r.firstTry, 0);
  return rateOf(attempts, firstTry);
}

const belowPar = (r: PatternRow, overall: number | null) =>
  r.rate != null &&
  overall != null &&
  r.rate < overall &&
  r.attempts - r.firstTry >= ENOUGH;

/** What to train first: tactics that cost you in games, most often first, then
 * ones you fail in practice more than your others. */
export function weakSpots(rows: PatternRow[], limit = 3) {
  const overall = overallRate(rows);
  return rows
    .filter((r) => r.misses > 0 || belowPar(r, overall))
    .sort(
      (a, b) =>
        b.misses - a.misses ||
        (a.rate ?? Number.POSITIVE_INFINITY) -
          (b.rate ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, limit);
}
