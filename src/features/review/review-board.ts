import type { BoardProps, MoveAttempt } from '../../chess/board';
import { isMove, type LinePath, nodeAt } from '../../chess/line-tree';
import { legalMoves, moveFromUci } from '../../chess/move';
import { answerLayers, refutationBoard } from '../../lib/lesson-board';
import type { LessonActions } from '../../lib/lesson-session';
import { gradeOf, stepTransition } from './review-moments';
import {
  atMoment,
  canExplore,
  type ReviewState,
  shownPositionId,
} from './review-session';

/** The review board for the session's state: a game position, a side line,
 * the find to answer or the board after their punishing reply. Game and
 * side-line positions take moves for either side through `play`. */
export function reviewBoard(
  state: ReviewState,
  actions: LessonActions,
  play: (attempt: MoveAttempt) => void = () => {},
): BoardProps | undefined {
  const { game, replay, view, exercise: e } = state;
  if (!game || !replay) return;
  const step = state.steps[state.step];
  const orientation = (game.color === 'black') !== state.flipped ? 'b' : 'w';
  if (state.line) return lineBoard(state, orientation, play);
  if (view === 'replay')
    return explorable(
      state,
      browse(state, state.replayIndex, 'review-replay', orientation),
      play,
    );
  // Only a find shows its own position; every other ply is the game's.
  if (state.stage === 'review' && (!atMoment(state) || step?.type !== 'find'))
    return explorable(
      state,
      browse(state, state.cursor, 'review-move', orientation),
      play,
    );
  const refutation = e?.refutation;
  if (view === 'lesson' && refutation && state.phase === 'wrong')
    return refutationBoard(
      refutation,
      orientation,
      { mode: 'read-only' },
      actions.retry,
    );
  const interactive = view === 'lesson' && step?.type === 'find' && !!e;
  const fen = step?.fen ?? replay.positions.at(-1);
  if (!fen) return;
  const id = e?.id ?? `review-done:${game.id}`;
  const answer = answerLayers(id, interactive ? e : {}, state, actions);
  // A found move sounds, tints and badges like a solved practice puzzle.
  const found =
    interactive && state.phase === 'answered' && e.mark !== 'missed'
      ? e.attempt
      : undefined;
  return {
    position: { id, fen },
    orientation,
    policy: interactive
      ? {
          mode: 'movable',
          sides: [game.color === 'black' ? 'b' : 'w'],
          moves: legalMoves(fen),
          submissionEnabled: state.phase === 'ready',
        }
      : { mode: 'read-only' },
    presentation: {
      showDestinations: interactive,
      highlights: found
        ? [
            { square: found.from, tone: 'success' },
            { square: found.to, tone: 'success' },
          ]
        : [],
      ...(found ? { correct: { square: found.to, id: found.attemptId } } : {}),
      arrows:
        interactive && e.hint && e.hintLevel === 2
          ? [{ ...moveFromUci(e.hint), tone: 'hint' }]
          : [],
      ...(interactive && e.hint
        ? { hint: { square: moveFromUci(e.hint).from } }
        : {}),
      ...answer.preview,
    },
    ...answer.controls,
  };
}
/** The game position with an arrow for the move that was best instead of
 * the one played, as Chess.com's review draws it. */
export function withBestArrow(
  board: BoardProps | undefined,
  bestUci: string | null | undefined,
): BoardProps | undefined {
  if (!board || !bestUci) return board;
  return {
    ...board,
    presentation: {
      ...board.presentation,
      arrows: [
        ...board.presentation.arrows,
        { ...moveFromUci(bestUci), tone: 'best' },
      ],
    },
  };
}
/** The starting position under the wide summary, read-only, facing you. */
export function summaryBoard(state: ReviewState): BoardProps | undefined {
  const { game, replay } = state;
  if (!game || !replay) return;
  const orientation = (game.color === 'black') !== state.flipped ? 'b' : 'w';
  return browse(state, 0, 'review-summary', orientation);
}

function browse(
  state: ReviewState,
  index: number,
  prefix: string,
  orientation: 'w' | 'b',
): BoardProps | undefined {
  const { game, replay } = state;
  const fen = replay?.positions[index];
  if (!game || !fen) return;
  const played = index > 0 ? game.plies[index - 1] : undefined;
  const grade = game.analysed ? gradeOf(played) : undefined;
  const last = played ? moveFromUci(played.uci) : undefined;
  const id = `${prefix}:${game.id}:${index}`;
  const motion = state.motion;
  const transition =
    motion?.to === index && Math.abs(motion.from - motion.to) === 1
      ? stepTransition(
          replay?.positions[Math.min(motion.from, motion.to)],
          game.san[Math.min(motion.from, motion.to)],
          motion.to > motion.from,
          { id: motion.id, positionId: id, reason: 'replay' },
        )
      : undefined;
  return {
    position: { id, fen },
    orientation,
    policy: { mode: 'read-only' },
    presentation: {
      showDestinations: false,
      highlights: [],
      arrows: [],
      ...(last ? { lastMove: last } : {}),
      ...(last && grade ? { grade: { square: last.to, kind: grade } } : {}),
      ...(transition ? { transition } : {}),
    },
    onAttempt: () => {},
  };
}

/** Lets a shown game position take moves for either side, as Lichess's
 * analysis board does, unless it is a find still to answer. */
function explorable(
  state: ReviewState,
  board: BoardProps | undefined,
  play: (attempt: MoveAttempt) => void,
): BoardProps | undefined {
  if (!board || !canExplore(state)) return board;
  return {
    ...board,
    policy: {
      mode: 'movable',
      sides: ['w', 'b'],
      moves: legalMoves(board.position.fen),
      submissionEnabled: true,
    },
    onAttempt: play,
  };
}

/** A side line's position in the line frame, its last move marked. */
function lineBoard(
  state: ReviewState,
  orientation: 'w' | 'b',
  play: (attempt: MoveAttempt) => void,
): BoardProps | undefined {
  const { tree, line } = state;
  const node = tree && line ? nodeAt(tree, line.path) : undefined;
  if (!tree || !line || !node) return;
  const id = shownPositionId(state);
  const last = isMove(node) ? moveFromUci(node.uci) : undefined;
  const motion = line.motion;
  const step = motion && adjacent(motion.from, motion.to);
  const transition =
    motion && step
      ? stepTransition(
          nodeAt(tree, step.parent)?.fen,
          step.uci,
          motion.to.length > motion.from.length,
          {
            id: motion.id,
            positionId: id,
            // A move you played already shows from the board's own state.
            reason: motion.played ? 'attempt' : 'replay',
          },
        )
      : undefined;
  return explorable(
    state,
    {
      position: { id, fen: node.fen },
      orientation,
      policy: { mode: 'read-only' },
      presentation: {
        showDestinations: false,
        lineMode: true,
        highlights: [],
        arrows: [],
        ...(last ? { lastMove: last } : {}),
        ...(transition ? { transition } : {}),
      },
      onAttempt: () => {},
    },
    play,
  );
}
/** The move between two paths one move apart, and the position before it. */
function adjacent(a: LinePath, b: LinePath) {
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  if (long.length !== short.length + 1) return;
  if (short.some((uci, i) => long[i] !== uci)) return;
  const uci = long.at(-1);
  return uci ? { parent: short, uci } : undefined;
}
