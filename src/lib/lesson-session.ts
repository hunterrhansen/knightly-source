import {
  createTransition,
  type MoveAttempt,
  type MoveVariant,
  type Transition,
} from '../chess/board';
import type { Principle } from '../chess/mistake-layers';
import { applyMove, moveFromUci } from '../chess/move';
import { ApiError } from './api/api-error';
import type { CoachExplanation } from './api/practice-contract';
import {
  type AnswerOutcome,
  landingSquare,
  type PointsAward,
  PointsLedger,
  pointsFor,
} from './lesson-points';

/** What practice and review sessions share: the store the screen subscribes
 * to, session points, timers, the opponent's punishing reply after a wrong
 * move and how a failed save is read. */

// Chess.com replies about 280 ms after a move; a punishing reply plays alike.
export const REPLY_DELAY_MS = 280;

/** Runs `run` after `ms`; returns a cancel. Tests pass their own clock. */
export type Schedule = (ms: number, run: () => void) => () => void;
export const schedule: Schedule = (ms, run) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

/** Thinking time sent with an answer: seconds, at most a day. */
export const thinkingSeconds = (ms: number) =>
  Math.min(86400, Math.max(0, ms / 1000));

/** A save the server definitely refused (signed out, forbidden or another
 * 4xx), as opposed to one whose outcome is unknown and must not be resent. */
export const definiteRejection = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  (error.kind === 'unauthenticated' ||
    error.kind === 'forbidden' ||
    (!!error.status && error.status >= 400 && error.status < 500));

/** A session's board callbacks: a move attempt and Try again. */
export type LessonActions = {
  attempt: (attempt: MoveAttempt) => unknown;
  retry: () => void;
};

/** The board after a wrong move and the opponent's punishing reply. */
export type Refutation = {
  positionId: string;
  fen: string;
  reply: MoveVariant;
  transition: Transition;
  /** The wrong move, still marked. */
  wrong: MoveVariant;
};
/** An exercise to answer: hinted, and refuted after a wrong move. */
type Answerable = {
  attempt?: MoveVariant;
  principle?: Principle;
  refutation?: Refutation;
  hinted: boolean;
  hint?: string;
  hintLevel: number;
};
/** The phases every lesson session goes through; a session adds its own. */
export type LessonPhase =
  | 'loading'
  | 'ready'
  | 'pending'
  /** A wrong move with an explanation: their reply is about to play. */
  | 'refuting'
  | 'wrong'
  | 'answered'
  | 'uncertain'
  | 'error'
  | 'complete';
/** The state every lesson session keeps: its phase (shared or one of `P`),
 * the coach's message, the open exercise and this session's points. */
export type LessonState<E, P extends string = never> = {
  phase: LessonPhase | P;
  message: string;
  exercise?: E;
  /** Consecutive clean answers this session: first try, no hint or solution. */
  combo?: number;
  /** Pattern points earned this session (not saved). */
  points?: number;
  /** The latest answer's points, for the shard's flight. */
  award?: PointsAward;
};

/** A session's external store for `useSyncExternalStore`. Points come from
 * the ledger, so no rebuilt state can drop them. */
export class LessonStore<
  E extends Answerable,
  P extends string,
  S extends LessonState<E, P>,
> {
  private listeners = new Set<() => void>();
  private ledger = new PointsLedger();
  private award?: PointsAward;
  /** An answer, hint or save in flight: other input waits. */
  protected running = false;
  constructor(
    protected state: S,
    protected isCurrent: () => boolean,
    protected schedule: Schedule,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** This session's points, for the results beat. */
  pointsSummary() {
    return this.ledger.summary();
  }
  protected set(state: S) {
    if (!this.isCurrent()) return;
    this.state = {
      ...state,
      points: this.ledger.total,
      ...(this.award ? { award: this.award } : {}),
    };
    for (const listener of this.listeners) listener();
  }
  protected matches(exercise: E) {
    return this.isCurrent() && this.state.exercise === exercise;
  }
  /** Records an answer's points at `positionId`; shown with the next state. */
  protected score(
    positionId: string,
    outcome: AnswerOutcome,
    combo: number,
    uci: string,
  ) {
    const award = this.ledger.record(
      positionId,
      pointsFor(outcome, combo),
      landingSquare(uci),
    );
    if (award) this.award = award;
  }
  /** A hint for the exercise at `fen`: the piece to move, then the move. */
  protected async giveHint(
    exercise: E,
    fen: string,
    loading: { phase: LessonPhase | P; message: string },
    load: () => Promise<string>,
  ) {
    this.running = true;
    const next = { ...exercise, hinted: true };
    this.set({ ...this.state, ...loading, exercise: next });
    try {
      const hint = exercise.hint ?? (await load());
      applyMove(fen, moveFromUci(hint));
      if (!this.matches(next)) return;
      this.set({
        ...this.state,
        phase: 'ready',
        exercise: { ...next, hint, hintLevel: exercise.hintLevel + 1 },
        message: exercise.hintLevel
          ? 'The arrow shows the move. Play it.'
          : `Look at the piece on ${moveFromUci(hint).from}.`,
      });
    } catch (error) {
      if (this.matches(next))
        this.set({
          ...this.state,
          phase: 'ready',
          exercise,
          message: error instanceof Error ? error.message : 'Hint unavailable.',
        });
    } finally {
      this.running = false;
    }
  }
  /** Duolingo-style: the opponent's punishing reply plays in REPLY_DELAY_MS
   * after the wrong move, then the coach says why it was missed. */
  protected refute(
    exercise: E,
    explanation: CoachExplanation,
    preview: string,
    {
      combo,
      message,
      nextId,
    }: {
      combo: number;
      /** Shown while their reply plays. */
      message: string;
      /** The refuted position's ID. */
      nextId: (refuting: E) => string;
    },
  ) {
    const wrong = exercise.attempt;
    if (!wrong) return;
    const reply = moveFromUci(explanation.reply_uci);
    const applied = applyMove(preview, reply);
    const principle = explanation.cause?.principle ?? explanation.principle;
    this.set({
      ...this.state,
      phase: 'refuting',
      combo,
      exercise,
      message,
    });
    const refuting = this.state.exercise;
    if (!refuting) return;
    this.schedule(REPLY_DELAY_MS, () => {
      if (!this.matches(refuting) || this.state.phase !== 'refuting') return;
      const positionId = nextId(refuting);
      this.set({
        ...this.state,
        phase: 'wrong',
        // Why it was missed, when a cause holds; it names their reply too.
        message: explanation.cause?.cause_text ?? explanation.reason_text,
        exercise: {
          ...refuting,
          ...(principle ? { principle } : {}),
          refutation: {
            positionId,
            fen: applied.fen,
            reply,
            wrong: { from: wrong.from, to: wrong.to },
            transition: createTransition(
              { id: `${positionId}:refute`, positionId, reason: 'opponent' },
              applied,
            ),
          },
        },
      });
    });
  }
}
