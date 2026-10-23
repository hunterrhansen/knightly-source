import type { Deck } from '../../lib/api/practice-contract';

type Counts = { done: number; total: number };

/** The lesson bar's done/total for a practice screen. The total stays fixed
 * for the whole visit: without a lesson count, today's positions and the
 * session's puzzles count as one run (positions first), so the bar never switches
 * totals when the puzzles start. The lesson and an extra watch keep their own
 * counts. `answered` adds an answer saved on the position still on screen,
 * before the next deck refresh counts it. */
export function practiceProgress({
  deck,
  lesson,
  extra = false,
  answered,
}: {
  deck?: Pick<Deck, 'today' | 'puzzles' | 'lesson' | 'extra'>;
  lesson: boolean;
  /** An extra watch: its own count, never tonight's lesson. */
  extra?: boolean;
  answered: boolean;
}): Counts | undefined {
  const counts = extra
    ? (deck?.extra ?? undefined)
    : lesson && deck?.lesson
      ? deck.lesson
      : deck && combined(deck);
  if (!counts || counts.total <= 0) return undefined;
  return {
    total: counts.total,
    done: Math.min(counts.total, counts.done + (answered ? 1 : 0)),
  };
}

function combined(deck: Pick<Deck, 'today' | 'puzzles'>): Counts {
  const puzzles = deck.puzzles;
  // Puzzles count once there are any to serve, or once some were solved.
  const puzzleTotal = puzzles
    ? puzzles.available
      ? Math.max(puzzles.session, puzzles.done)
      : puzzles.done
    : 0;
  return {
    total: deck.today.total + puzzleTotal,
    done:
      Math.min(deck.today.done, deck.today.total) +
      Math.min(puzzles?.done ?? 0, puzzleTotal),
  };
}
