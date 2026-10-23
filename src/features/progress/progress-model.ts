import type { FirstStar } from '../../lib/api/journey-contract';
import type {
  GameTrend,
  Overview,
  ProgressRange,
  SkillAxisKey,
  TrendSkillKey,
} from '../../lib/api/progress-contract';
import { addDays, type StreakDayState, type StreakDays } from '../../ui';

export const rangeNames: Record<ProgressRange, string> = {
  '30d': '30 days',
  '90d': '90 days',
  all: 'all time',
};

/** Rated games before the rating line draws a trend. */
export const MIN_RATED_GAMES = 5;
/** Analysed games before the skill shape can show, as the backend's minimum. */
export const MIN_SHAPE_GAMES = 10;

// ---- Last 4 weeks ---------------------------------------------------------

export const HABIT_DAYS = 28;

/** The last four weeks ending today, oldest first, each day's streak state
 * as the calendar shows it (unknown days blank, never missed). */
export function lastFourWeeks(days: StreakDays | undefined, today: string) {
  return Array.from({ length: HABIT_DAYS }, (_, index) => {
    const id = addDays(today, index - (HABIT_DAYS - 1));
    const state: StreakDayState =
      days?.[id] ?? (id === today ? 'today' : 'none');
    return { id, state };
  });
}

/** The device's calendar day as `YYYY-MM-DD`; the backend keeps streak days
 * in the same user-local time zone (Today syncs it). */
export function localToday(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Nights in a row up to today: practiced or frozen days, not breaking on
 * today while it is still open. */
export function currentRun(cells: { state: StreakDayState }[]) {
  let run = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    const state = cells[i]?.state;
    if (state === 'done' || state === 'frozen') run++;
    else if (!(i === cells.length - 1 && state === 'today')) break;
  }
  return run;
}

/** "Down 25% from the 30 days before", from the two periods' blunder rates;
 * null without both or with no earlier blunders to compare against. */
export function blunderTrend(
  now: number | null | undefined,
  before: number | null | undefined,
) {
  if (now == null || before == null || before === 0) return null;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0)
    return { better: false, text: 'Blunders are level with the month before.' };
  return change < 0
    ? {
        better: true,
        text: `Blunders are down ${-change}% from the 30 days before.`,
      }
    : {
        better: false,
        text: `Blunders are up ${change}% from the 30 days before. Nightly practice brings them back down.`,
      };
}

// ---- Your game ------------------------------------------------------------

export type SkillAxis = {
  key: SkillAxisKey;
  label: string;
  score: number | null;
  previous: number | null;
  /** Games behind the score, for the unlock count. */
  games: number;
};

const axisLabels: Record<SkillAxisKey, string> = {
  safety: 'Safety',
  tactics: 'Tactics',
  calculation: 'Calculation',
  converting: 'Converting',
  defending: 'Defending',
};
const axisOrder = Object.keys(axisLabels) as SkillAxisKey[];

/** The five axes in their fixed order; every score null when the server
 * does not send a skill shape yet. */
export function skillAxes(shape: Overview['skill_shape']): SkillAxis[] {
  return axisOrder.map((key) => {
    const axis = shape?.axes.find((a) => a.key === key);
    return {
      key,
      label: axisLabels[key],
      score: axis?.score ?? null,
      previous: axis?.previous?.score ?? null,
      games: axis?.games ?? 0,
    };
  });
}

/** The lowest scored axis; ties keep the fixed order (Safety first). */
export function weakestAxis(axes: SkillAxis[]) {
  return axes.reduce<SkillAxis | null>(
    (low, axis) =>
      axis.score != null && (low?.score == null || axis.score < low.score)
        ? axis
        : low,
    null,
  );
}

type Layers = NonNullable<Overview['layers']>;
const settled = (layers: Layers) =>
  layers.theirThreat +
  layers.theirReply +
  layers.calculation +
  layers.ownTactic +
  layers.other;
const percent = (value: number | null | undefined) =>
  value == null ? null : Math.round(value * 100);

export type FocusAdvice = {
  title: string;
  /** One sentence from the player's own games; null without the data. */
  evidence: string | null;
  action: { label: string; href: string };
};

// ---- In your games ---------------------------------------------------------

/** Eligible games before the trend compares two windows of ten, as the
 * backend's minimum. */
export const TREND_MIN_GAMES = 20;

const trendNames: Record<TrendSkillKey, string> = {
  safety: 'Missed threats',
  tactics: 'Missed tactics',
  calculation: 'Failed forcing lines',
};

const perGame = (count: number, window: number) => (count / window).toFixed(1);
const practiced = (count: number) =>
  count === 0
    ? 'none practiced'
    : `${count} ${count === 1 ? 'position' : 'positions'} practiced`;

/** One skill's trend as a row: the recent rate a game, the change against
 * the games before only when the server calls one, and the practice since. */
export function trendRows(trend: GameTrend) {
  return trend.skills.map((skill) => {
    const now = skill.recent / trend.window;
    const called = skill.change === 'fewer' || skill.change === 'more';
    const done = practiced(skill.practice.recent);
    return {
      key: skill.key,
      label: trendNames[skill.key],
      value: perGame(skill.recent, trend.window),
      change: called ? now - skill.earlier / trend.window : null,
      hint:
        skill.change === 'same'
          ? `About the same as the ${trend.window} before; ${done}`
          : `${done.charAt(0).toUpperCase()}${done.slice(1)}`,
    };
  });
}

/** "In your last 20 games: 0.8 missed threats a game, down from 1.4, with
 * 64 positions practiced." Null without a trend to report. */
function trendSentence(
  trend: GameTrend | null | undefined,
  key: TrendSkillKey,
) {
  const skill = trend?.skills.find((s) => s.key === key);
  if (!trend || trend.reason || !skill?.change) return null;
  const n = trend.window;
  const before = perGame(skill.earlier, n);
  const compared =
    skill.change === 'same'
      ? `about the same as the ${n} before`
      : `${skill.change === 'fewer' ? 'down' : 'up'} from ${before}`;
  return `In your last ${n} games: ${perGame(skill.recent, n)} ${trendNames[key].toLowerCase()} a game, ${compared}, with ${practiced(skill.practice.recent)}.`;
}

/** What to do about the weakest axis: a habit to build, the evidence from
 * your games and the one place that trains it. */
export function focusFor(
  axis: SkillAxisKey,
  overview: Pick<Overview, 'layers' | 'kpis' | 'game_trend'>,
  range: ProgressRange,
): FocusAdvice {
  const layers = overview.layers;
  const total = layers ? settled(layers) : 0;
  const share = (count: number, what: string) =>
    total ? `${count} of your ${total} mistakes ${what}.` : null;
  const trend = (key: TrendSkillKey) => trendSentence(overview.game_trend, key);
  switch (axis) {
    case 'safety':
      return {
        title: 'Check their threat first',
        evidence:
          trend('safety') ??
          (layers
            ? share(
                layers.theirThreat + layers.theirReply,
                'missed what your opponent was threatening',
              )
            : null),
        action: { label: 'Practice their threats', href: '/practice' },
      };
    case 'tactics':
      return {
        title: 'Look for your own tactics',
        evidence:
          trend('tactics') ??
          (layers ? share(layers.ownTactic, 'missed a tactic you had') : null),
        action: { label: 'Practice tactics', href: '/practice' },
      };
    case 'calculation':
      return {
        title: 'See the line to its end',
        evidence:
          trend('calculation') ??
          (layers
            ? share(layers.calculation, 'were forcing lines that failed later')
            : null),
        action: { label: 'Practice your positions', href: '/practice' },
      };
    case 'converting': {
      const rate = percent(overview.kpis.conversion);
      return {
        title: 'Finish the games you’re winning',
        evidence:
          rate == null
            ? null
            : `You won ${rate}% of games once you were clearly ahead.`,
        action: {
          label: 'Review thrown wins',
          href: `/games?range=${range}&kpi=thrown`,
        },
      };
    }
    case 'defending': {
      const rate = percent(overview.kpis.comeback_rate);
      return {
        title: 'Keep fighting when behind',
        evidence:
          rate == null
            ? null
            : `You saved ${rate}% of games once you were clearly behind.`,
        action: {
          label: 'Review your comebacks',
          href: `/games?range=${range}&kpi=comebacks`,
        },
      };
    }
  }
}

/** The closest move's memory in whole days, rounded down so it never reads
 * as the bar before it is reached. */
export const firstStarDays = (closest: FirstStar) =>
  Math.min(closest.target, Math.floor(closest.days));

/** Progress toward the first star, from the held move closest to the
 * 11-day bar (`/api/journey`'s `first_star`). */
export function firstStarLine(closest: FirstStar) {
  const days = firstStarDays(closest);
  const held = `Holds ${days} of ${closest.target} days`;
  // A held move short of a star is either under the bar or, past it, still
  // owed a puzzle of its tactic (a move with no tactic stops at the bar).
  if (!closest.needs_family) return `${held}. Each Good answer stretches it.`;
  return closest.days >= closest.target
    ? `${held}. Solve one puzzle of its tactic to earn the star.`
    : `${held}, then one puzzle of its tactic solved.`;
}

/** The proof row: blunders per game this period against the one before. */
export function blunderProof(
  now: number | null | undefined,
  before: number | null | undefined,
) {
  if (now == null) return null;
  return {
    text:
      before == null
        ? now.toFixed(1)
        : `${before.toFixed(1)} → ${now.toFixed(1)}`,
    better: before == null ? null : now < before,
  };
}
