import type { RefObject } from 'react';
import { useMemo } from 'react';
import { applyMove } from '../move';
import { type Position, parsePosition } from '../position';
import type { MoveAttempt } from './board.types';
import { createTransition } from './transition';

/**
 * As on Lichess and Chess.com, the player's move shows at once from the
 * board's own state while the owner's slower re-render confirms it.
 */
export function useInstantMove(
  pending: MoveAttempt | undefined,
  position: Position,
  fastTraveled: RefObject<{ from: string; to: string } | undefined>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the slide is read when the attempt appears, not tracked
  return useMemo(() => {
    if (!pending || pending.positionId !== position.id) return undefined;
    try {
      const applied = applyMove(position.fen, pending);
      const after = parsePosition(applied.fen);
      if (!after.ok) return undefined;
      return {
        parsed: after.value,
        fen: applied.fen,
        lastMove: { from: pending.from, to: pending.to },
        // Dropped, or already slid by the display thread: no second travel.
        drag:
          pending.source === 'drag' ||
          (fastTraveled.current?.from === pending.from &&
            fastTraveled.current.to === pending.to),
        transition: createTransition(
          {
            id: `instant:${pending.attemptId}`,
            positionId: position.id,
            reason: 'attempt',
          },
          applied,
        ),
      };
    } catch {
      return undefined;
    }
  }, [pending, position.fen, position.id]);
}
