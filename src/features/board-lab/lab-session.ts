import type {
  Feedback,
  MoveAttempt,
  MoveVariant,
  Policy,
  Presentation,
} from '../../chess/board';
import { createTransition } from '../../chess/board';
import { applyMove, legalMoves } from '../../chess/move';
import type { Position } from '../../chess/position';
import { type LabFixtureId, labFixtures } from './lab-fixtures';

export type LabMode = 'practice' | 'review';
type Assistance = 'none' | 'concept' | 'origin' | 'solution';
type SimulatedOutcome = 'grade' | 'reject' | 'fail' | 'uncertain';
export type LabState = Readonly<{
  sessionId: string;
  mode: LabMode;
  fixtureId: LabFixtureId;
  revision: number;
  position: Position;
  presentation: Presentation;
  policy: Policy;
  feedback?: Feedback;
  misses: number;
  assistance: Assistance;
  history: readonly Position[];
  reviewIndex: number;
  phase:
    | 'ready'
    | 'pending'
    | 'rejected'
    | 'failed'
    | 'uncertain'
    | 'accepted'
    | 'opponent'
    | 'complete'
    | 'review'
    | 'skipped';
  attempt?: MoveAttempt;
  completion?: string;
}>;
export type LabEvent =
  | { type: 'attempt'; attempt: MoveAttempt }
  | {
      type: 'result';
      sessionId: string;
      feedback: Feedback;
      acceptedFen?: string;
    }
  | { type: 'simulate'; outcome: SimulatedOutcome }
  | { type: 'retry' }
  | { type: 'hint'; level: Exclude<Assistance, 'none'> }
  | { type: 'skip' }
  | {
      type: 'navigate';
      position: Position;
      sessionId: string;
      fixtureId?: LabFixtureId;
    }
  | { type: 'review-index'; index: number }
  | {
      type: 'transition-complete';
      sessionId?: string;
      transitionId: string;
      positionId: string;
    };
const sameMove = (a: MoveVariant, b: MoveVariant) =>
  a.from === b.from && a.to === b.to && a.promotion === b.promotion;
const presentation = (): Presentation => ({
  showDestinations: true,
  highlights: [],
  arrows: [],
});
function withPolicy(state: LabState): LabState {
  return {
    ...state,
    policy:
      state.mode === 'review'
        ? { mode: 'read-only' }
        : {
            mode: 'movable',
            sides: ['w'],
            moves: legalMoves(state.position.fen),
            submissionEnabled: state.phase === 'ready',
          },
  };
}
export function createLabState(
  sessionId: string,
  mode: LabMode,
  fixtureId: LabFixtureId = 'opening',
): LabState {
  const fixture = labFixtures[fixtureId];
  const position = { id: `${sessionId}:0`, fen: fixture.fen };
  const history: Position[] = [position];
  if (mode === 'review') {
    const player = {
      id: `${sessionId}:history-1`,
      fen: applyMove(position.fen, fixture.answer).fen,
    };
    history.push(player, {
      id: `${sessionId}:history-2`,
      fen: applyMove(player.fen, fixture.reply).fen,
    });
  }
  return withPolicy({
    sessionId,
    mode,
    fixtureId,
    revision: 0,
    position: history[history.length - 1] ?? position,
    history,
    reviewIndex: history.length - 1,
    presentation: presentation(),
    policy: { mode: 'read-only' },
    misses: 0,
    assistance: 'none',
    phase: mode === 'review' ? 'review' : 'ready',
  });
}
function simulatedResult(
  state: LabState,
  outcome: SimulatedOutcome,
): Extract<LabEvent, { type: 'result' }> {
  const attempt = state.attempt;
  const accepted =
    outcome === 'grade' &&
    !!attempt &&
    sameMove(attempt, labFixtures[state.fixtureId].answer);
  const status =
    outcome === 'fail'
      ? 'failed'
      : outcome === 'uncertain'
        ? 'uncertain'
        : accepted
          ? 'resolved'
          : 'rejected';
  const messages = {
    pending: 'Demo move pending.',
    failed: 'Simulated connection failure. Reconcile the retained attempt.',
    uncertain: 'Simulated outcome unknown. Reconcile the retained attempt.',
    resolved: 'Demo move accepted.',
    rejected:
      'That legal move is not the authored demo answer. Retry is unlimited.',
  };
  return {
    type: 'result',
    sessionId: state.sessionId,
    feedback: {
      positionId: attempt?.positionId ?? '',
      attemptId: attempt?.attemptId ?? '',
      outcome: status,
      message: messages[status],
    },
    ...(accepted && attempt
      ? { acceptedFen: applyMove(state.position.fen, attempt).fen }
      : {}),
  };
}
export function labReducer(state: LabState, event: LabEvent): LabState {
  if (event.type === 'simulate')
    return labReducer(state, simulatedResult(state, event.outcome));
  if (event.type === 'navigate') {
    const fresh = createLabState(
      event.sessionId,
      state.mode,
      event.fixtureId ?? state.fixtureId,
    );
    return state.mode === 'review'
      ? fresh
      : withPolicy({
          ...fresh,
          position: event.position,
          history: [event.position],
        });
  }
  if (event.type === 'review-index') {
    if (
      state.mode !== 'review' ||
      !Number.isInteger(event.index) ||
      !state.history[event.index]
    )
      return state;
    const revision = state.revision + 1;
    const position = {
      ...(state.history[event.index] ?? state.position),
      id: `${state.sessionId}:${revision}`,
    };
    return {
      ...state,
      revision,
      position,
      reviewIndex: event.index,
      presentation: {
        ...presentation(),
        transition: createTransition({
          id: `${position.id}:navigation`,
          positionId: position.id,
          reason: 'navigation',
        }),
      },
    };
  }
  if (event.type === 'attempt') {
    if (
      state.phase !== 'ready' ||
      event.attempt.positionId !== state.position.id ||
      !legalMoves(state.position.fen).some((move) =>
        sameMove(move, event.attempt),
      )
    )
      return state;
    const applied = applyMove(state.position.fen, event.attempt);
    return withPolicy({
      ...state,
      phase: 'pending',
      attempt: event.attempt,
      feedback: {
        ...event.attempt,
        outcome: 'pending',
        message: 'Demo move pending. Choose a simulation result.',
      },
      presentation: {
        ...presentation(),
        preview: {
          fen: applied.fen,
          positionId: state.position.id,
          attemptId: event.attempt.attemptId,
        },
        transition: createTransition(
          {
            id: `${state.position.id}:${event.attempt.attemptId}:preview`,
            positionId: state.position.id,
            reason: 'attempt',
          },
          applied,
        ),
      },
    });
  }
  if (event.type === 'result') {
    if (
      !['pending', 'failed', 'uncertain'].includes(state.phase) ||
      !state.attempt ||
      event.sessionId !== state.sessionId ||
      event.feedback.positionId !== state.position.id ||
      event.feedback.attemptId !== state.attempt.attemptId ||
      event.feedback.outcome === 'pending'
    )
      return state;
    if (event.feedback.outcome !== 'resolved')
      return withPolicy({
        ...state,
        feedback: event.feedback,
        phase: event.feedback.outcome,
        presentation: {
          ...state.presentation,
          highlights:
            event.feedback.outcome === 'rejected'
              ? [{ square: state.attempt.to, tone: 'error' }]
              : [],
        },
        misses: state.misses + (event.feedback.outcome === 'rejected' ? 1 : 0),
      });
    const applied = applyMove(state.position.fen, state.attempt);
    if (event.acceptedFen !== applied.fen) return state;
    const revision = state.revision + 1;
    const position = { id: `${state.sessionId}:${revision}`, fen: applied.fen };
    return withPolicy({
      ...state,
      revision,
      position,
      history: [...state.history, position],
      phase: 'accepted',
      attempt: undefined,
      feedback: event.feedback,
      completion:
        state.assistance !== 'none'
          ? 'Assisted demo success; no progress saved.'
          : state.misses
            ? 'Demo success after retries; no progress saved.'
            : 'Independent demo success; no progress saved.',
      presentation: {
        ...presentation(),
        lastMove: state.attempt,
        correct:
          state.mode === 'practice'
            ? { square: state.attempt.to, id: state.attempt.attemptId }
            : undefined,
        transition: createTransition(
          {
            id: `${position.id}:confirmed`,
            positionId: position.id,
            reason: 'confirmed',
          },
          applied,
        ),
      },
    });
  }
  if (event.type === 'retry') {
    if (state.phase !== 'rejected') return state;
    const revision = state.revision + 1;
    return withPolicy({
      ...state,
      revision,
      position: { ...state.position, id: `${state.sessionId}:${revision}` },
      phase: 'ready',
      feedback: undefined,
      attempt: undefined,
      presentation: presentation(),
    });
  }
  if (event.type === 'hint') {
    if (
      state.mode !== 'practice' ||
      !['ready', 'rejected'].includes(state.phase)
    )
      return state;
    const levels: Assistance[] = ['none', 'concept', 'origin', 'solution'];
    const assistance =
      levels[
        Math.max(levels.indexOf(state.assistance), levels.indexOf(event.level))
      ] ?? state.assistance;
    const answer = labFixtures[state.fixtureId].answer;
    return {
      ...state,
      assistance,
      presentation: {
        ...state.presentation,
        hint: ['origin', 'solution'].includes(assistance)
          ? { square: answer.from }
          : undefined,
        arrows:
          assistance === 'solution'
            ? [{ from: answer.from, to: answer.to, tone: 'best' }]
            : [],
      },
    };
  }

  if (event.type === 'skip')
    return state.mode === 'practice' &&
      ['ready', 'rejected'].includes(state.phase)
      ? withPolicy({
          ...state,
          phase: 'skipped',
          attempt: undefined,
          feedback: undefined,
          presentation: presentation(),
          completion: 'Demo exercise skipped; no progress saved.',
        })
      : state;
  if (event.type === 'transition-complete') {
    if (
      (event.sessionId && event.sessionId !== state.sessionId) ||
      event.positionId !== state.position.id ||
      event.transitionId !== state.presentation.transition?.id
    )
      return state;
    if (state.phase === 'accepted') {
      const moves = legalMoves(state.position.fen);
      const move =
        moves.find((move) =>
          sameMove(move, labFixtures[state.fixtureId].reply),
        ) ?? moves[0];
      if (!move)
        return withPolicy({
          ...state,
          phase: 'complete',
          presentation: { ...state.presentation, transition: undefined },
        });
      const applied = applyMove(state.position.fen, move);
      const revision = state.revision + 1;
      const position = {
        id: `${state.sessionId}:${revision}`,
        fen: applied.fen,
      };
      return withPolicy({
        ...state,
        revision,
        position,
        phase: 'opponent',
        feedback: undefined,
        history: [...state.history, position],
        presentation: {
          ...presentation(),
          lastMove: move,
          correct: state.presentation.correct,
          transition: createTransition(
            {
              id: `${position.id}:opponent`,
              positionId: position.id,
              reason: 'opponent',
            },
            applied,
          ),
        },
      });
    }
    if (state.phase === 'opponent')
      return withPolicy({
        ...state,
        phase: 'complete',
        presentation: { ...state.presentation, transition: undefined },
      });
  }
  return state;
}
