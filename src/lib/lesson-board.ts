import type { BoardProps, MoveAttempt } from '../chess/board';
import type { LessonActions, LessonPhase, Refutation } from './lesson-session';

/** An answer on the board at `positionId`: its previewed position, the
 * board's feedback on it for the session's phase, and the callbacks. */
export function answerLayers<P extends string>(
  positionId: string,
  { attempt, preview }: { attempt?: MoveAttempt; preview?: string },
  { phase, message }: { phase: LessonPhase | P; message: string },
  actions: LessonActions,
) {
  const outcome =
    phase === 'pending' || phase === 'refuting'
      ? 'pending'
      : phase === 'wrong'
        ? 'rejected'
        : phase === 'uncertain' || phase === 'checking'
          ? 'uncertain'
          : 'resolved';
  const attemptId = attempt?.attemptId ?? '';
  return {
    preview:
      attempt && preview
        ? { preview: { fen: preview, positionId, attemptId } }
        : {},
    controls: {
      ...(attempt
        ? { feedback: { positionId, attemptId, outcome, message } as const }
        : {}),
      onAttempt: (next: MoveAttempt) => {
        void actions.attempt(next);
      },
      onRestorePosition: actions.retry,
    },
  };
}

/** The board after the opponent's punishing reply: the wrong move still
 * marked, and Try again restoring the position. */
export function refutationBoard(
  refutation: Refutation,
  orientation: 'w' | 'b',
  policy: BoardProps['policy'],
  retry: () => void,
): BoardProps {
  return {
    position: { id: refutation.positionId, fen: refutation.fen },
    orientation,
    policy,
    presentation: {
      showDestinations: false,
      lastMove: refutation.reply,
      transition: refutation.transition,
      highlights: [
        { square: refutation.wrong.from, tone: 'error', badge: false },
        { square: refutation.wrong.to, tone: 'error', badge: false },
      ],
      arrows: [],
    },
    onAttempt: () => {},
    onRestorePosition: retry,
  };
}
