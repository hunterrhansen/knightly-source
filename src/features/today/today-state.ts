import type {
  DailyReview,
  DailyReviewStep,
} from '../../lib/api/today-contract';

/** Hours before the user's day ends when an untouched streak is shown as at risk. */
export const AT_RISK_HOURS = 4;
// Rough per-item minutes for the plan's "about N min" estimate.
// A lesson item is a position, a threat question or a puzzle.
const MINUTES = { game: 4, item: 0.5, puzzle: 0.75 };
// Streak lengths the Done state celebrates with confetti.
const STREAK_MILESTONES: readonly number[] = [7, 30, 100, 365];
export const isStreakMilestone = (count: number) =>
  STREAK_MILESTONES.includes(count);

type TodayStep = DailyReviewStep & { href: string };
/** What Today's main button opens: the daily lesson, or the game review on a day
 * with nothing to practice. */
export type TodayStart =
  | { kind: 'lesson'; done: number; total: number; href: string }
  | TodayStep;
const LESSON_HREF = '/practice?mode=lesson';

const focusNames = {
  safety: 'missed threats',
  tactics: 'missed tactics',
  calculation: 'failed forcing lines',
} as const;

/** The section banner's subtitle: it describes the lesson's lean (the day's
 * focus when the server picked one), never decides what is due. */
export const sectionSubtitle = (focus: DailyReview['focus']) =>
  focus ? `Mostly ${focusNames[focus.key]} lately` : 'Your past mistakes';
/** Tonight's night, all time: the Nth night kept is night N, so before
 * tonight is kept it is the next one. The path's own number (from
 * `/api/journey`) is the same; this is for when it is not drawn. Older
 * servers without the all-time count: the streak's. */
export function tonightNight(streak: DailyReview['streak']) {
  const total = streak.nights_total ?? streak.count;
  return streak.safe_today ? Math.max(1, total) : total + 1;
}

/** The streak in words, beside a night's number: always "N in a row", so a
 * night number is never the streak's. */
export const inARow = (count: number) => `${count} in a row`;

/** The first import's analysis: games checked of those it will check. */
export type GamesChecked = { done: number; total: number };
type LessonStart = Extract<TodayStart, { kind: 'lesson' }>;
export type TodayState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'new' }
  | { kind: 'processing'; step: string | null; checked: GamesChecked | null }
  | {
      /** No night kept yet and tonight's lesson is ready: the first night's
       * path ends in "Start first watch". */
      kind: 'first';
      review: DailyReview;
      start: LessonStart;
      minutes: number;
      checked: GamesChecked | null;
    }
  | { kind: 'rest'; review: DailyReview }
  | {
      kind: 'ready' | 'returning' | 'at-risk';
      review: DailyReview;
      start: TodayStart;
      minutes: number;
      /** The game review, offered beside the lesson when it is waiting. */
      game: TodayStep | null;
      /** Hours left in the user's day. */
      hoursLeft: number;
    }
  | {
      kind: 'done';
      review: DailyReview;
      /** "Keep going": the day's full plan, and its next unfinished step. */
      steps: TodayStep[];
      next: TodayStep | null;
    };

function href(step: DailyReviewStep, review: DailyReview) {
  if (step.kind === 'game')
    return review.game ? `/review/${review.game.id}` : '/games';
  return LESSON_HREF;
}

const withHrefs = (review: DailyReview) =>
  review.plan.map((step) => ({ ...step, href: href(step, review) }));

/** "Keep going" between steps, from the server's plan after a step saved: what is
 * finished, the next unfinished step, and whether the whole plan is complete. */
export function dailyProgress(review: DailyReview) {
  const steps = withHrefs(review);
  const next = steps.find((step) => !step.done) ?? null;
  return {
    steps,
    next,
    finished: steps.length > 0 && !next,
    minutes: next ? minutesLeft(steps) : 0,
  };
}

function minutesLeft(steps: TodayStart[]) {
  let total = 0;
  for (const step of steps) {
    if (step.kind === 'lesson')
      total += (step.total - step.done) * MINUTES.item;
    else if (step.done) continue;
    else if (step.kind === 'game') total += MINUTES.game;
    else
      total +=
        (step.total - step.count) *
        (step.kind === 'positions' ? MINUTES.item : MINUTES.puzzle);
  }
  return Math.max(1, Math.round(total));
}

/** What Today shows, from the daily review and the import state. Pure: `now` is passed in.
 * The lesson leads until the streak is safe for today; then Done offers the rest. */
export function todayState(
  input: {
    review?: DailyReview;
    error?: string;
    accounts?: number;
    importing?: boolean;
    importStep?: string | null;
    /** The import's analysis progress, while it runs. */
    checked?: GamesChecked | null;
  },
  now: Date,
): TodayState {
  const { review } = input;
  if (!review)
    return input.error
      ? { kind: 'error', message: input.error }
      : { kind: 'loading' };
  const steps = withHrefs(review);
  const { lesson } = review;
  const checked =
    input.importing && input.checked?.total ? input.checked : null;
  if (!steps.length && !lesson.total) {
    if (input.accounts === 0 && review.memory.total === 0)
      return { kind: 'new' };
    if (input.importing)
      return { kind: 'processing', step: input.importStep ?? null, checked };
    return { kind: 'rest', review };
  }
  // Never kept a night (older servers without the all-time count: never had
  // a streak) and the lesson is untouched: the first watch.
  const neverKept = (review.streak.nights_total ?? review.streak.best) === 0;
  if (
    neverKept &&
    !review.streak.safe_today &&
    lesson.total > 0 &&
    lesson.done === 0
  ) {
    const start = { kind: 'lesson' as const, ...lesson, href: LESSON_HREF };
    return {
      kind: 'first',
      review,
      start,
      minutes: minutesLeft([start]),
      checked,
    };
  }
  const game = steps.find((step) => step.kind === 'game' && !step.done) ?? null;
  const start: TodayStart | null =
    lesson.done < lesson.total
      ? { kind: 'lesson', ...lesson, href: LESSON_HREF }
      : game;
  if (review.streak.safe_today || !start)
    return {
      kind: 'done',
      review,
      steps,
      next: steps.find((step) => !step.done) ?? null,
    };
  const common = {
    review,
    start,
    minutes: minutesLeft([start]),
    game: start === game ? null : game,
  };
  const started = lesson.done > 0;
  const hoursLeft = Math.max(
    0,
    (Date.parse(review.day_ends_at) - now.getTime()) / 3_600_000,
  );
  const kind =
    !started && review.streak.count > 0 && hoursLeft <= AT_RISK_HOURS
      ? 'at-risk'
      : started
        ? 'returning'
        : 'ready';
  return { kind, ...common, hoursLeft };
}
