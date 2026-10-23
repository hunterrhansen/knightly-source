/** Fewer positions than this and the deck is small (backend deck.SMALL_DECK). */
const SMALL_DECK = 20;

export type DeckGrowth =
  | { kind: 'no-games' }
  | { kind: 'analyzing'; text: string }
  | { kind: 'clean'; text: string; puzzles: boolean }
  | { kind: 'small'; text: string }
  | { kind: 'growing' };

const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`;

/**
 * Why the deck is empty or small, from its size and the games behind it, for
 * Practice and Today. `puzzles` is whether puzzles can fill in meanwhile.
 * Without `counts` (an older server) only the deck size is known.
 */
export function deckGrowth(
  total: number,
  counts: { analyzed: number; pending: number } | undefined,
  puzzles: boolean,
): DeckGrowth {
  if (!counts) return { kind: 'growing' };
  const { analyzed, pending } = counts;
  if (total === 0) {
    if (pending > 0)
      return {
        kind: 'analyzing',
        text: `Analyzing your games: ${analyzed} of ${analyzed + pending} done. Positions to practice appear as each one finishes.`,
      };
    if (analyzed > 0)
      return {
        kind: 'clean',
        puzzles,
        text: `No clear-cut mistakes in your ${games(analyzed)}. Nice. Play or import more games to grow your deck.${puzzles ? ' Meanwhile, practice puzzles in your weakest tactic.' : ''}`,
      };
    return { kind: 'no-games' };
  }
  if (total < SMALL_DECK && analyzed > 0)
    return {
      kind: 'small',
      text: `Your deck grows as you play: ${total} ${total === 1 ? 'position' : 'positions'} from ${games(analyzed)}.`,
    };
  return { kind: 'growing' };
}
