import { type BoardProps, createTransition } from '../../chess/board';
import { applyMove, legalMoves, moveFromUci } from '../../chess/move';
import { answerLayers, refutationBoard } from '../../lib/lesson-board';
import type { LessonActions } from '../../lib/lesson-session';
import {
  NO_THREAT,
  type PracticeState,
  questionBoard,
} from './practice-session';

/** The last board, held read-only while the next position loads: the move
 * it was answering is shown as played, without that answer's preview, which
 * the board would reject once its feedback is cleared. */
export function heldBoard(board: BoardProps): BoardProps {
  const {
    preview,
    transition: _transition,
    ...presentation
  } = board.presentation;
  return {
    ...board,
    position: {
      id: `${board.position.id}:held`,
      fen: preview?.fen ?? board.position.fen,
    },
    policy: { mode: 'read-only' },
    presentation,
    feedback: undefined,
  };
}

/** The practice board for the session's state: the setup move playing in,
 * the threat question, a line playing or the position to answer. */
export function practiceBoard(
  state: PracticeState,
  actions: LessonActions,
): BoardProps | undefined {
  const e = state.exercise;
  if (!e) return undefined;
  const side = e.item.color === 'white' ? 'w' : 'b';
  const still = {
    mode: 'movable',
    sides: [side],
    moves: [],
    submissionEnabled: false,
  } as const;
  if (e.setup && !e.entered)
    return {
      position: { id: `${e.positionId}:setup`, fen: e.setup.fen },
      orientation: side,
      policy: still,
      presentation: {
        showDestinations: false,
        highlights: [],
        arrows: [],
        transition: e.arrival,
      },
      onAttempt: () => {},
    };
  const phase_ = state.phase;
  if (e.threat && (phase_ === 'threat' || phase_ === 'threat-shown')) {
    // The position the question is answered from: if you passed, after your
    // own move, or your own turn; the board takes that side's moves.
    const { fen: asked, side: moving } = questionBoard(e.item);
    const answer = e.threat.answer;
    const given =
      answer && answer !== NO_THREAT ? moveFromUci(answer) : undefined;
    const tone = e.threat.correct ? 'success' : 'error';
    return {
      position: {
        id: phase_ === 'threat' ? e.positionId : `${e.positionId}:shown`,
        fen: asked,
      },
      orientation: side,
      policy:
        phase_ === 'threat'
          ? {
              mode: 'movable',
              sides: [moving],
              moves: legalMoves(asked),
              submissionEnabled: true,
            }
          : { mode: 'read-only' },
      presentation: {
        showDestinations: true,
        ...(e.lastMove ? { lastMove: e.lastMove } : {}),
        ...(phase_ === 'threat' && e.transition?.positionId === e.positionId
          ? { transition: e.transition }
          : {}),
        // A right answer sounds and badges like a solved puzzle; "No threat"
        // has no square, so it only sounds.
        ...(phase_ === 'threat-shown' && e.threat.correct
          ? {
              correct: {
                ...(given ? { square: given.to } : {}),
                id: `${e.positionId}:threat`,
              },
            }
          : {}),
        highlights: given
          ? [
              { square: given.from, tone, badge: false },
              { square: given.to, tone },
            ]
          : [],
        arrows:
          phase_ === 'threat-shown'
            ? e.threat.threats.map((t) => ({
                ...moveFromUci(t.uci),
                // A loose piece is yours to take: the best move, not a danger.
                tone: moving === side ? ('best' as const) : ('danger' as const),
              }))
            : [],
      },
      onAttempt: (a) => {
        void actions.attempt(a);
      },
    };
  }
  const playing = state.phase === 'answered' ? e.candidate : undefined;
  if (playing)
    return lineBoard(
      `${e.positionId}:${playing.uci}`,
      playing.fens,
      playing.moves,
      playing.view,
      side,
    );
  if (e.line && e.view !== undefined)
    // Revealing or stepping through the line: each ply is its own position.
    return lineBoard(
      `${e.positionId}:line`,
      e.line.fens,
      e.line.uci,
      e.view,
      side,
    );
  const refutation = e.refutation;
  if (refutation && state.phase === 'wrong')
    return refutationBoard(refutation, side, still, actions.retry);
  const attempt = e.attempt;
  const phase = state.phase;
  const answer = answerLayers(e.positionId, e, state, actions);
  const solved =
    attempt &&
    ((phase === 'answered' &&
      e.quality !== undefined &&
      e.quality !== 'shown' &&
      e.quality !== 'wrong') ||
      phase === 'replying');
  return {
    position: { id: e.positionId, fen: e.fen },
    orientation: side,
    policy: {
      mode: 'movable',
      sides: [side],
      moves: legalMoves(e.fen),
      submissionEnabled: phase === 'ready',
    },
    presentation: {
      showDestinations: true,
      ...(e.lastMove ? { lastMove: e.lastMove } : {}),
      ...(e.transition?.positionId === e.positionId
        ? { transition: e.transition }
        : e.arrival.positionId === e.positionId && !attempt
          ? { transition: e.arrival }
          : {}),
      // Chess.com puzzles: tint both squares; a check or cross on the
      // destination only, and the check only once the line is solved.
      ...(attempt && solved && phase === 'answered'
        ? { correct: { square: attempt.to, id: attempt.attemptId } }
        : {}),
      highlights:
        attempt && solved
          ? [
              { square: attempt.from, tone: 'success' },
              { square: attempt.to, tone: 'success' },
            ]
          : attempt && phase === 'wrong'
            ? [
                { square: attempt.from, tone: 'error', badge: false },
                { square: attempt.to, tone: 'error' },
              ]
            : [],
      arrows:
        // The hint marks the piece until an answer is on the board, then
        // returns on Try again, as on Chess.com.
        e.hint && e.hintLevel === 2 && !attempt
          ? [{ ...moveFromUci(e.hint), tone: 'hint' }]
          : // The move played in the game, in red, until a new answer.
            e.item.kind === 'card' &&
              !e.item.unannounced &&
              !e.played.length &&
              !attempt &&
              ['ready', 'hinting'].includes(phase)
            ? [{ ...moveFromUci(e.item.uci), tone: 'danger' }]
            : [],
      ...(e.hint && e.hintLevel >= 1 && !attempt
        ? { hint: { square: moveFromUci(e.hint).from } }
        : {}),
      ...answer.preview,
    },
    ...answer.controls,
  };
}
/** A line's position after `view` plies, its last move sliding in. */
function lineBoard(
  prefix: string,
  fens: readonly string[],
  moves: readonly string[],
  view: number,
  side: 'w' | 'b',
): BoardProps {
  const id = `${prefix}:${view}`;
  const uci = moves[view - 1];
  const before = fens[view - 1];
  return {
    position: { id, fen: fens[view] ?? fens[0] ?? '' },
    orientation: side,
    policy: {
      mode: 'movable',
      sides: [side],
      moves: [],
      submissionEnabled: false,
    },
    presentation: {
      showDestinations: false,
      highlights: [],
      arrows: [],
      ...(uci && before
        ? {
            lastMove: moveFromUci(uci),
            transition: createTransition(
              { id, positionId: id, reason: 'opponent' },
              applyMove(before, moveFromUci(uci)),
            ),
          }
        : {}),
    },
    onAttempt: () => {},
  };
}
