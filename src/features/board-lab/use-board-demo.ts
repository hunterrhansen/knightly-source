import { useMemo, useState } from 'react';
import type {
  Feedback,
  MoveAttempt,
  Policy,
  Transition,
} from '../../chess/board';
import { createTransition } from '../../chess/board';
import { applyMove, describeMove, legalMoves } from '../../chess/move';
import type { Position } from '../../chess/position';

export const demoStart =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const demoPromotion = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
let sequence = 0;
const positionFor = (fen: string): Position => ({
  id: `demo-${++sequence}`,
  fen,
});
// Local input sandbox only: no grading, persistence, network or progression.
export function useBoardDemo(initialFen = demoStart) {
  const [session, setSession] = useState<{
    position: Position;
    feedback?: Feedback;
    description?: string;
    lastMove?: MoveAttempt;
    transition?: Transition;
  }>(() => ({ position: positionFor(initialFen) }));
  const [readOnly, setReadOnly] = useState(false);
  const replace = (fen: string) => {
    const position = positionFor(fen);
    setSession({
      position,
      transition: createTransition({
        id: `${position.id}:reset`,
        positionId: position.id,
        reason: 'reset',
      }),
    });
  };
  const reset = () => replace(initialFen);
  const onAttempt = (attempt: MoveAttempt) => {
    if (attempt.positionId !== session.position.id) return;
    const applied = applyMove(session.position.fen, attempt);
    const position = positionFor(applied.fen);
    const next = {
      position,
      transition: createTransition(
        {
          id: `${position.id}:move`,
          positionId: position.id,
          reason: 'confirmed',
        },
        applied,
      ),
      feedback: {
        attemptId: attempt.attemptId,
        positionId: attempt.positionId,
        outcome: 'resolved',
        message: 'Move applied in the local sandbox.',
      } as const,
      lastMove: attempt,
      description: describeMove(session.position.fen, attempt),
    };
    setSession((previous) =>
      previous.position.id === attempt.positionId ? next : previous,
    );
  };
  const policy = useMemo<Policy>(() => {
    if (readOnly || session.position.fen === 'invalid')
      return { mode: 'read-only' };
    return {
      mode: 'movable',
      sides: ['w', 'b'],
      moves: legalMoves(session.position.fen),
      submissionEnabled: true,
    };
  }, [readOnly, session.position.fen]);
  return {
    ...session,
    policy,
    onAttempt,
    replace,
    reset,
    readOnly,
    setReadOnly,
  };
}
