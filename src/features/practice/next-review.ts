import type { PracticeCard } from '../../lib/api/practice-contract';

type Rating = 'again' | 'hard' | 'good' | 'easy';

// The server's Easy (deck.EASY_SECONDS): the line's own moves, each within this
// on average. Local grading cannot see Easy, so it picks the preview here; the
// saved answer still corrects the line if the two ever disagree.
const EASY_SECONDS = 10;

/** The rating the day's graded answer will be saved with. */
export function savedRating(
  rating: Rating,
  quality: string,
  learnerMoves: number,
  seconds: number | undefined,
): Rating {
  return rating === 'good' &&
    quality === 'best' &&
    seconds !== undefined &&
    seconds <= EASY_SECONDS * learnerMoves
    ? 'easy'
    : rating;
}

const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const about = (n: number, unit: string) =>
  `about ${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * The quiet line under the day's graded verdict: when this position comes back.
 * `due` counts from the review day `today`, as the server stores it; `mastered`
 * is whether this answer makes it long-term and `wasMastered` whether it was.
 */
export function nextReviewLine({
  rating,
  due,
  today,
  mastered,
  wasMastered,
}: {
  rating: Rating;
  due: string;
  today: string;
  mastered: boolean;
  wasMastered: boolean;
}) {
  if (rating === 'again') return 'Back tomorrow.';
  const n = days(today, due);
  if (mastered && !wasMastered)
    return `In long-term memory. Back in ${about(Math.max(1, Math.round(n / 30)), 'month')}.`;
  if (n <= 1) return 'Back tomorrow.';
  if (n < 30) return `Back in ${n} days.`;
  return n < 60
    ? `Back in ${about(Math.round(n / 7), 'week')}.`
    : `Back in ${about(Math.round(n / 30), 'month')}.`;
}

/** The line for a card from its served preview, or undefined without one. */
export function previewLine(card: PracticeCard, rating: Rating, today: string) {
  const next = card.next?.[rating];
  return next
    ? nextReviewLine({
        rating,
        due: next.due,
        today,
        mastered: next.mastered,
        wasMastered: card.mastered ?? false,
      })
    : undefined;
}
