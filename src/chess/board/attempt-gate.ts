import type { Feedback, MoveAttempt } from './board.types';

type AttemptGate = {
  claim(attempt: MoveAttempt): boolean;
  settle(feedback: Feedback): boolean;
  reset(positionId: string): void;
};
export function createAttemptGate(initialPositionId: string): AttemptGate {
  let positionId = initialPositionId;
  let active: MoveAttempt | undefined;
  return {
    claim(attempt) {
      if (active || attempt.positionId !== positionId) return false;
      active = attempt;
      return true;
    },
    settle(feedback) {
      if (
        !active ||
        feedback.outcome === 'pending' ||
        feedback.positionId !== active.positionId ||
        feedback.attemptId !== active.attemptId
      )
        return false;
      active = undefined;
      return true;
    },
    reset(nextId) {
      positionId = nextId;
      active = undefined;
    },
  };
}
