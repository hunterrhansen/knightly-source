import type { MoveAttempt } from '../../chess/board';
import {
  addLine,
  deleteFrom,
  gamePath,
  gamePlies,
  gameTree,
  type LinePath,
  type LineTree,
  nodeAt,
  pathKey,
} from '../../chess/line-tree';
import type { Principle } from '../../chess/mistake-layers';
import { applyMove, moveFromUci, uciOf } from '../../chess/move';
import type { ApiClient } from '../../lib/api/client';
import {
  type CoachExplanation,
  type Deck,
  legalExplanations,
} from '../../lib/api/practice-contract';
import type { GameDetail, ReviewMark } from '../../lib/api/review-contract';
import {
  definiteRejection,
  type LessonState,
  LessonStore,
  type Refutation,
  type Schedule,
  schedule,
  thinkingSeconds,
} from '../../lib/lesson-session';
import {
  buildLesson,
  type Replay,
  type ReviewStep,
  replayGame,
} from './review-lesson';
import { notablePlies } from './review-moments';

/** Review's own phases beside the shared ones: saving the finished review. */
type Phase = 'saving' | 'save-uncertain';
export type Exercise = {
  id: string;
  /** Stays the same across retries: the served map is matched to it. */
  key: string;
  hinted: boolean;
  hint?: string;
  hintLevel: number;
  attempted: boolean;
  started: number;
  attempt?: MoveAttempt;
  preview?: string;
  mark?: ReviewMark['mark'];
  /** After a wrong move with an explanation: the board after their reply. */
  refutation?: Refutation;
  /** The habit the wrong move points to (blunder causes). */
  principle?: Principle;
};
export type ReviewState = LessonState<Exercise, Phase> & {
  game?: GameDetail;
  replay?: Replay;
  steps: ReviewStep[];
  blocked?: string;
  step: number;
  marks: ReviewMark[];
  deck?: Deck;
  view: 'lesson' | 'replay';
  replayIndex: number;
  flipped: boolean;
  /** The summary page, then the move-by-move review. */
  stage: 'summary' | 'review';
  /** The position shown in the review: plies played so far, 0 at the start. */
  cursor: number;
  /** The plies Next stops on (notable moves and every lesson step). */
  moments: number[];
  /** The last one-move step between positions, animated on the board. */
  motion?: { from: number; to: number; id: string };
  /** The game's moves first at every position, then lines played or opened. */
  tree?: LineTree;
  /** A side line on the board in place of the game: its moves from the
   * start, the branch point it cannot step back past, and the last one-move
   * step along it. The cursor (or All moves' move) stays where you left the
   * game, for Back to game. */
  line?: {
    path: string[];
    start: number;
    motion?: { from: LinePath; to: LinePath; id: string; played?: boolean };
  };
  /** Where Next's quick run through the moves is heading, while it runs. */
  playingTo?: number;
  /** Where you had stepped to before Next took you back to a question you
   * stepped past; Next returns there once it is answered. */
  resumeAt?: number;
  /** The open find's prepared coaching for wrong moves, by exercise key. */
  coaching?: {
    key: string;
    explanations: Record<string, CoachExplanation>;
    /** First-move grades, so a find is judged at once (the server re-grades). */
    grades?: Record<string, 'best' | 'excellent' | 'good' | 'wrong'>;
  };
};
/** An answer's verdict, from the server or judged locally. */
type Answer = {
  correct: boolean;
  quality: string;
  rating: string | null;
  best_uci: string;
  best_san: string;
};
/** The lesson step being answered, unless the review is done or blocked. */
function activeStep(state: ReviewState) {
  const step = state.steps[state.step];
  return step && state.phase !== 'complete' && !state.blocked
    ? step
    : undefined;
}
/** Whether the review shows the active lesson step rather than a game move. */
export function atMoment(state: ReviewState) {
  const step = activeStep(state);
  return (
    state.stage === 'review' &&
    state.view === 'lesson' &&
    !state.line &&
    !!step &&
    state.cursor === step.ply
  );
}
/** The board's position id for what the review shows off the find board:
 * a game move or a side line's. Moves played there carry it. */
export function shownPositionId(state: ReviewState) {
  const id = state.game?.id;
  if (state.line) return `review-line:${id}:${pathKey(state.line.path)}`;
  return state.view === 'replay'
    ? `review-replay:${id}:${state.replayIndex}`
    : `review-move:${id}:${state.cursor}`;
}
/** Whether moves can be played on the shown position: anywhere but the
 * position of a find you are still to answer, as its answer would show. */
export function canExplore(state: ReviewState) {
  if (!state.tree || (state.view === 'lesson' && state.stage !== 'review'))
    return false;
  const guarded = unsolvedFindPosition(state);
  if (guarded === undefined) return true;
  const ply = state.line
    ? gamePlies(state.tree, state.line.path) === state.line.path.length
      ? state.line.path.length
      : -1
    : state.view === 'replay'
      ? state.replayIndex
      : state.cursor;
  return ply !== guarded;
}
/** The game position (plies played) of a find still to answer, whose moves
 * and engine evaluation would give its answer away. */
function unsolvedFindPosition(state: ReviewState) {
  const step = activeStep(state),
    e = state.exercise;
  return step?.type === 'find' && e && !e.mark && !e.hinted
    ? step.ply - 1
    : undefined;
}
/** The live engine's path for a game position, unless it is a find still to
 * answer: the stored analysis stays the only eval there. */
export function liveEnginePath(state: ReviewState, index: number) {
  if (!state.tree || unsolvedFindPosition(state) === index) return undefined;
  return gamePath(state.tree, index);
}

export class ReviewSession extends LessonStore<Exercise, Phase, ReviewState> {
  private revision = 0;
  private pendingFinish?: { marks: ReviewMark[]; baseline: string | null };
  constructor(
    private api: Pick<
      ApiClient,
      'game' | 'deck' | 'answer' | 'hint' | 'finishReview' | 'cardFeedback'
    >,
    private gameId: number,
    isCurrent: () => boolean,
    private onSaved: () => void = () => {},
    private now = () => Date.now(),
    run: Schedule = schedule,
  ) {
    super(
      {
        phase: 'loading',
        message: 'Loading game…',
        steps: [],
        step: 0,
        marks: [],
        view: 'lesson',
        replayIndex: 0,
        flipped: false,
        stage: 'summary',
        cursor: 0,
        moments: [],
      },
      isCurrent,
      run,
    );
  }
  /** Next's run through the moves before a key moment, one step at a time. */
  private playing?: { target: number; cancel: () => void };
  private stopPlaying() {
    if (!this.playing) return;
    this.playing.cancel();
    this.playing = undefined;
    this.set({ ...this.state, playingTo: undefined });
  }
  /** The in-flight map request for the open find step. */
  private mapRequest?: AbortController;
  private open(step: number) {
    const moment = this.state.steps[step];
    const id = moment
      ? `review:${this.gameId}:${++this.revision}:${moment.ply}`
      : '';
    this.set({
      ...this.state,
      step,
      view: 'lesson',
      phase: 'ready',
      message: moment
        ? moment.title
        : 'No key moments to solve. Replay the game or finish review.',
      exercise: moment
        ? {
            id,
            key: id,
            hinted: false,
            hintLevel: 0,
            attempted: false,
            started: this.now(),
          }
        : undefined,
    });
    this.mapRequest?.abort();
    this.mapRequest = undefined;
    if (moment?.type === 'find') void this.loadMap(id, moment.ply, moment.fen);
  }
  /** Fetches the card's grade map so a wrong move can be answered from it.
   * A map arriving after the step closed, or for another account, is dropped;
   * without one the find keeps its plain "Not quite". */
  private async loadMap(key: string, ply: number, fen: string) {
    const request = new AbortController();
    this.mapRequest = request;
    try {
      const map = await this.api.cardFeedback(this.gameId, ply, request.signal);
      if (
        request.signal.aborted ||
        !this.isCurrent() ||
        this.state.exercise?.key !== key
      )
        return;
      const explanations = legalExplanations(fen, map?.explanations);
      if (Object.keys(explanations).length || map?.grades)
        this.set({
          ...this.state,
          coaching: { key, explanations, grades: map?.grades },
        });
    } catch {
      /* Coaching is optional: the find works without it. */
    } finally {
      if (this.mapRequest === request) this.mapRequest = undefined;
    }
  }
  load = async () => {
    if (
      this.running ||
      !this.isCurrent() ||
      !['loading', 'error'].includes(this.state.phase)
    )
      return;
    this.running = true;
    this.set({ ...this.state, phase: 'loading', message: 'Loading game…' });
    try {
      const game = await this.api.game(this.gameId);
      if (!this.isCurrent()) return;
      const replay = replayGame(game),
        lesson = buildLesson(game, replay);
      this.set({
        ...this.state,
        game,
        replay,
        ...lesson,
        moments: lesson.blocked ? [] : notablePlies(game, lesson.steps),
        tree: gameTree(game.start_fen, game.san),
        line: undefined,
        marks: [],
        phase: 'ready',
        view: lesson.blocked ? 'replay' : 'lesson',
        message: lesson.blocked ?? 'Review your key moments.',
      });
      if (game.reviewed_at)
        this.set({
          ...this.state,
          phase: 'complete',
          marks: game.review_marks,
          message: 'Saved review',
          view: 'lesson',
        });
      else if (!lesson.blocked) {
        this.open(0);
        // Today's deck, so finds are judged at once; without it the first
        // answer fetches it, as before.
        void this.api.deck().then(
          (deck) =>
            this.isCurrent() &&
            !this.state.deck &&
            this.set({ ...this.state, deck }),
          () => {},
        );
      }
    } catch (error) {
      this.set({
        ...this.state,
        phase: 'error',
        message:
          error instanceof Error ? error.message : 'Could not load game.',
      });
    } finally {
      this.running = false;
    }
  };
  restart = () => {
    if (this.running || this.state.phase !== 'complete' || this.state.blocked)
      return;
    this.set({ ...this.state, marks: [] });
    this.open(0);
  };
  replay = () =>
    this.browseAt(this.state.stage === 'review' ? this.state.cursor : 0);
  /** All moves, opened on a given move (a summary row or graph point). */
  browseAt = (index: number) => {
    const last = (this.state.replay?.positions.length ?? 1) - 1;
    if (this.running) return;
    this.set({
      ...this.state,
      view: 'replay',
      line: undefined,
      replayIndex: Math.max(0, Math.min(last, index)),
    });
  };
  /** In All moves, the active unsolved find's answer stays hidden until this. */
  answerHidden = (index: number) => {
    const step = this.activeStep(),
      e = this.state.exercise;
    return (
      step?.type === 'find' && index === step.ply && !!e && !e.mark && !e.hinted
    );
  };
  revealAnswer = () => {
    const e = this.state.exercise;
    if (this.running || !e || !this.answerHidden(this.state.replayIndex))
      return;
    this.set({
      ...this.state,
      exercise: { ...e, hinted: true },
      message:
        'You viewed the answer. This lesson answer will count as helped.',
    });
  };
  private activeStep() {
    return activeStep(this.state);
  }
  /** Whether the review shows the active lesson step rather than a game move. */
  atMoment = () => atMoment(this.state);
  begin = () => {
    if (this.running || !this.state.game) return;
    if (this.state.phase === 'complete' && !this.state.blocked) this.restart();
    this.set({
      ...this.state,
      stage: 'review',
      view: 'lesson',
      line: undefined,
      cursor: 0,
      resumeAt: undefined,
    });
  };
  /** ‹ › and tapping a move: any ply, without grading anything. */
  goTo = (index: number) => {
    this.stopPlaying();
    this.moveCursor(index);
  };
  private moveCursor(index: number) {
    const last = (this.state.replay?.positions.length ?? 1) - 1;
    if (this.running || this.state.stage !== 'review') return;
    const to = Math.max(0, Math.min(last, index));
    this.set({
      ...this.state,
      cursor: to,
      line: undefined,
      motion: this.motion(this.state.cursor, to),
    });
  }
  /**
   * Plays every move up to `target` as a quick run of slides, as Chess.com's
   * Next does: about 120 ms a move, a long gap squeezed into about 1.2 s.
   */
  private playTo(target: number) {
    this.stopPlaying();
    const steps = target - this.state.cursor;
    if (steps <= 1) return this.moveCursor(target);
    const delay = Math.max(30, Math.min(120, Math.floor(1200 / steps)));
    const run = { target, cancel: () => {} };
    this.playing = run;
    this.set({ ...this.state, playingTo: target });
    const tick = () => {
      if (this.playing !== run || !this.isCurrent()) return;
      this.moveCursor(this.state.cursor + 1);
      if (this.state.cursor < target) run.cancel = this.schedule(delay, tick);
      else {
        this.playing = undefined;
        this.set({ ...this.state, playingTo: undefined });
      }
    };
    tick();
  }
  private motion(from: number, to: number) {
    return { from, to, id: `review-step:${this.gameId}:${++this.revision}` };
  }
  stepBy = (delta: -1 | 1) => this.goTo(this.state.cursor + delta);
  /** Next: finish the step on screen, then jump to the next notable move,
   * never past an unfinished lesson step; at the end, save the review. */
  next = () => {
    if (
      this.running ||
      this.state.stage !== 'review' ||
      this.state.view !== 'lesson' ||
      !this.state.replay
    )
      return;
    // Next from a side line goes back to the game, then does what it does.
    if (this.state.line) this.set({ ...this.state, line: undefined });
    // Next during the run skips to where it was going.
    if (this.playing) {
      const { target } = this.playing;
      this.stopPlaying();
      return this.moveCursor(target);
    }
    let active = this.activeStep();
    if (active && this.atMoment()) {
      const before = this.state.step;
      this.continue();
      if (this.state.step === before) return;
      active = this.activeStep();
    }
    // Back from a question you had stepped past: return to where you were.
    const resume = this.state.resumeAt;
    if (resume !== undefined) {
      this.set({ ...this.state, resumeAt: undefined });
      if (resume > this.state.cursor) {
        this.passMoments(resume);
        return this.goTo(resume);
      }
    }
    const cursor = this.state.cursor,
      last = this.state.replay.positions.length - 1;
    // Next carries on from where you stepped to: moments you walked past
    // count as seen, so nothing replays. A question you walked past is the
    // one exception: Next cuts straight back to it, remembering this spot.
    active = this.passMoments(cursor);
    if (active && cursor > active.ply) {
      this.set({ ...this.state, resumeAt: cursor });
      return this.goTo(active.ply);
    }
    let target = this.state.moments.find((p) => p > cursor) ?? last;
    if (active) target = Math.min(target, active.ply);
    if (target > cursor) return this.playTo(target);
    if (!active && this.state.step === this.state.steps.length)
      void this.finish();
  };
  /** Records the looks and praise before `ply` as seen, as Continue would;
   * stops at the first question. Returns the step then active. */
  private passMoments(ply: number) {
    let active = this.activeStep();
    while (active && active.type !== 'find' && active.ply < ply) {
      const before = this.state.step;
      this.continue();
      if (this.state.step === before) break;
      active = this.activeStep();
    }
    return active;
  }
  lesson = () => {
    if (!this.running && !this.state.blocked)
      this.set({ ...this.state, view: 'lesson', line: undefined });
  };
  select = (index: number) => {
    this.stopPlaying();
    if (this.running || !this.state.replay) return;
    const to = Math.max(
      0,
      Math.min(this.state.replay.positions.length - 1, index),
    );
    this.set({
      ...this.state,
      replayIndex: to,
      line: undefined,
      motion: this.motion(this.state.replayIndex, to),
    });
  };
  /** The game move the review shows, where a side line leaves from. */
  private viewPly() {
    return this.state.view === 'replay'
      ? this.state.replayIndex
      : this.state.cursor;
  }
  /** Goes to a game move in whichever view is open. */
  private toPly(ply: number) {
    if (this.state.view === 'replay') this.select(ply);
    else this.goTo(ply);
  }
  private shownPath(): string[] | undefined {
    const tree = this.state.tree;
    if (!tree) return;
    return this.state.line?.path ?? gamePath(tree, this.viewPly());
  }
  /** A move played on a game or side-line position, as on Lichess's analysis
   * board: the game's own next move steps forward, an existing line's move
   * steps into it, anything else starts a side line. Never graded. */
  play = (attempt: MoveAttempt) => {
    const tree = this.state.tree,
      path = this.shownPath();
    if (
      this.running ||
      !tree ||
      !path ||
      !canExplore(this.state) ||
      attempt.positionId !== shownPositionId(this.state)
    )
      return;
    const played = addLine(tree, path, [uciOf(attempt)], 'user');
    if (!played) return;
    this.stopPlaying();
    const line = this.state.line;
    if (!line && gamePlies(played.tree, played.path) === played.path.length) {
      // The game's move: the board already shows it, so no second slide.
      const to = played.path.length;
      if (this.state.view === 'replay')
        this.set({ ...this.state, replayIndex: to, motion: undefined });
      else this.set({ ...this.state, cursor: to, motion: undefined });
      return;
    }
    this.set({
      ...this.state,
      tree: played.tree,
      line: {
        path: played.path,
        start: line?.start ?? path.length,
        motion: {
          from: path,
          to: played.path,
          id: `line-play:${this.gameId}:${++this.revision}`,
          played: true,
        },
      },
    });
  };
  /** Best or Explain: the stored engine line as a side line from `start`
   * (the game's moves up to it), showing its first move. */
  openLine = (start: number, moves: readonly string[]) => {
    const tree = this.state.tree;
    if (this.running || !tree || !moves.length) return false;
    const from = gamePath(tree, start);
    const opened = addLine(tree, from, moves, 'engine');
    if (!opened) return false;
    this.stopPlaying();
    const first = opened.path.slice(0, from.length + 1);
    this.set({
      ...this.state,
      tree: opened.tree,
      line: {
        path: first,
        start: from.length,
        motion: {
          from,
          to: first,
          id: `line-step:${this.gameId}:${++this.revision}`,
        },
      },
    });
    return true;
  };
  /** A side-line move tapped in the move list. */
  openPath = (path: readonly string[]) => {
    const tree = this.state.tree;
    if (this.running || !tree || !nodeAt(tree, path)) return;
    const start = gamePlies(tree, path);
    if (start === path.length) return this.toPly(start);
    this.stopPlaying();
    this.set({ ...this.state, line: { path: [...path], start } });
  };
  /** ‹ › along the line on the board: back to its branch point, where the
   * game takes over, or on along its first continuation. */
  lineStep = (delta: -1 | 1) => {
    const tree = this.state.tree,
      line = this.state.line;
    if (this.running || !tree || !line) return;
    const next = nodeAt(tree, line.path)?.children[0]?.uci;
    const to =
      delta < 0
        ? line.path.slice(0, -1)
        : next
          ? [...line.path, next]
          : line.path;
    if (to.length === line.path.length) return;
    if (to.length <= line.start && gamePlies(tree, to) === to.length) {
      // Back at the branch point: the game, as Back to game would show it.
      this.set({ ...this.state, line: undefined });
      if (to.length !== this.viewPly()) this.toPly(to.length);
      return;
    }
    this.set({
      ...this.state,
      line: {
        ...line,
        path: to,
        motion: {
          from: line.path,
          to,
          id: `line-step:${this.gameId}:${++this.revision}`,
        },
      },
    });
  };
  /** Back to game: the game move you left the game from. */
  closeLine = () => {
    if (this.state.line) this.set({ ...this.state, line: undefined });
  };
  /** Delete from here: a side line's move and everything after it. */
  deleteLine = (path: readonly string[]) => {
    const tree = this.state.tree;
    if (this.running || !tree) return;
    const pruned = deleteFrom(tree, path);
    if (pruned === tree) return;
    const line = this.state.line;
    const inside =
      line && pathKey(line.path.slice(0, path.length)) === pathKey(path);
    if (!line || !inside) return this.set({ ...this.state, tree: pruned });
    const back = path.slice(0, -1);
    this.set({
      ...this.state,
      tree: pruned,
      line:
        back.length <= line.start && gamePlies(pruned, back) === back.length
          ? undefined
          : { ...line, path: back },
    });
  };
  flip = () => {
    if (!this.running)
      this.set({ ...this.state, flipped: !this.state.flipped });
  };
  attempt = async (attempt: MoveAttempt) => {
    const e = this.state.exercise,
      step = this.state.steps[this.state.step];
    if (
      !e ||
      !step ||
      step.type !== 'find' ||
      this.running ||
      this.state.view !== 'lesson' ||
      this.state.phase !== 'ready' ||
      attempt.positionId !== e.id
    )
      return;
    try {
      const preview = applyMove(step.fen, attempt).fen;
      await this.submit({ ...e, attempt, preview }, uciOf(attempt));
    } catch {
      /* Illegal local input never reaches the API. */
    }
  };
  reveal = async () => {
    const e = this.state.exercise;
    if (
      e &&
      !this.running &&
      this.state.steps[this.state.step]?.type === 'find' &&
      ['ready', 'wrong'].includes(this.state.phase)
    )
      await this.submit(
        { ...e, hinted: true, refutation: undefined, principle: undefined },
        '0000',
      );
  };
  /** The verdict the server would give, from what is already in hand: the
   * stored best move, the find's prepared grade map and today's deck (whether
   * this ply was answered earlier). Undefined when only the server can say. */
  private judge(
    e: Exercise,
    step: ReviewStep,
    uci: string,
  ): Answer | undefined {
    const deck = this.state.deck;
    const played = this.state.game?.plies[step.ply - 1];
    if (!deck || !played?.best_uci || !played.best_san) return undefined;
    const grades =
      this.state.coaching?.key === e.key
        ? this.state.coaching.grades
        : undefined;
    const quality =
      uci === '0000'
        ? 'shown'
        : uci === played.best_uci
          ? 'best'
          : grades?.[uci];
    if (!quality) return undefined;
    const prior = this.answeredBefore(e, step, deck);
    return {
      correct: ['best', 'excellent', 'good'].includes(quality),
      quality,
      // Only the first answer of the day is rated; a hint rates it "again".
      rating: prior ? null : 'good',
      best_uci: played.best_uci,
      best_san: played.best_san,
    };
  }
  private answeredBefore(e: Exercise, step: ReviewStep, deck: Deck) {
    return (
      e.attempted ||
      deck.results.some((r) => r.game_id === this.gameId && r.ply === step.ply)
    );
  }
  /** Background saves, in order; Continue waits for them to land. */
  private saving?: Promise<void>;
  private async submit(e: Exercise, uci: string) {
    const step = this.state.steps[this.state.step];
    if (!step) return;
    const local = this.judge(e, step, uci);
    if (local) {
      // Shown at once, as practice does; the server re-grades as it saves.
      const prior = this.answeredBefore(e, step, this.state.deck as Deck);
      this.show(e, step, uci, local, prior);
      this.save(e, step, uci, local);
      return;
    }
    this.running = true;
    this.set({
      ...this.state,
      exercise: e,
      phase: 'pending',
      message: 'Checking your move and saving progress…',
    });
    let sent = false;
    try {
      const deck = await this.api.deck();
      if (!this.matches(e)) return;
      if (this.state.deck && this.state.deck.server_day !== deck.server_day) {
        this.set({
          ...this.state,
          phase: 'wrong',
          message:
            'A new practice day has started. Restore this position before answering.',
          exercise: { ...e, attempt: undefined, preview: undefined },
          deck,
        });
        return;
      }
      this.set({ ...this.state, deck });
      sent = true;
      const prior = this.answeredBefore(e, step, deck);
      const answer = await this.post(e, step, uci, deck);
      if (!this.matches(e)) return;
      this.show(e, step, uci, answer, prior);
    } catch (error) {
      if (!this.matches(e)) return;
      this.unsaved(error, sent);
    } finally {
      this.running = false;
    }
  }
  private post(e: Exercise, step: ReviewStep, uci: string, deck: Deck) {
    return this.api.answer({
      game_id: this.gameId,
      ply: step.ply,
      uci,
      expected_day: deck.server_day,
      hinted: e.hinted,
      redo: false,
      seconds: thinkingSeconds(this.now() - e.started),
    });
  }
  private unsaved(error: unknown, sent: boolean) {
    this.set({
      ...this.state,
      phase: !sent || definiteRejection(error) ? 'wrong' : 'uncertain',
      message:
        !sent || definiteRejection(error)
          ? `${error instanceof Error ? error.message : 'Move not accepted.'} Restore the position to try again.`
          : 'The answer save is unconfirmed. Check saved progress; this answer will not be resent.',
    });
  }
  /** Saves an answer already shown. The server's verdict replaces the shown
   * one when they differ (a stale map); a failed save takes the verdict back
   * with the usual recovery, and Continue waits until the save lands. */
  private save(e: Exercise, step: ReviewStep, uci: string, shown: Answer) {
    const deck = this.state.deck;
    if (!deck) return;
    const key = e.key;
    const combo = this.state.combo;
    const saving = (this.saving ?? Promise.resolve()).then(async () => {
      const prior = this.answeredBefore(e, step, deck);
      try {
        const saved = await this.post(e, step, uci, deck);
        const current = this.state.exercise;
        if (!this.isCurrent() || current?.key !== key) return;
        if (saved.correct !== shown.correct || saved.quality !== shown.quality)
          this.show(
            { ...current, attempt: e.attempt, preview: e.preview },
            step,
            uci,
            saved,
            prior,
          );
      } catch (error) {
        if (!this.isCurrent() || this.state.exercise?.key !== key) return;
        // The shown verdict is taken back: the answer is as unsaved as if it
        // had waited, with the same recovery.
        this.set({ ...this.state, exercise: e, combo });
        this.unsaved(error, true);
      }
    });
    this.saving = saving;
    void saving.finally(() => {
      if (this.saving === saving) this.saving = undefined;
    });
  }
  /** Shows an answer's verdict: the mark, points and message, or their
   * punishing reply when the map explains the wrong move. */
  private show(
    e: Exercise,
    step: ReviewStep,
    uci: string,
    answer: Answer,
    prior: boolean,
  ) {
    const best = moveFromUci(answer.best_uci),
      preview = applyMove(step.fen, best).fen;
    const shown = answer.quality === 'shown';
    const coaching = this.state.coaching;
    const explanation =
      !answer.correct && !shown && coaching?.key === e.key
        ? coaching.explanations[uci]
        : undefined;
    if (explanation && e.preview) {
      this.refute({ ...e, attempted: true }, explanation, e.preview, {
        combo: 0,
        message: '',
        nextId: (refuting) => `${refuting.id}:refute`,
      });
      return;
    }
    const mark: ReviewMark['mark'] | undefined = shown
      ? 'missed'
      : !answer.correct
        ? undefined
        : e.hinted || prior || answer.rating === null
          ? 'helped'
          : answer.quality === 'good'
            ? 'good'
            : 'found';
    const clean = mark === 'found' || mark === 'good';
    const combo = clean ? (this.state.combo ?? 0) + 1 : 0;
    if (mark)
      this.score(
        e.id,
        clean ? 'clean' : mark === 'helped' ? 'helped' : 'none',
        combo,
        uci,
      );
    this.set({
      ...this.state,
      phase: mark ? 'answered' : 'wrong',
      combo,
      exercise: {
        ...e,
        attempted: true,
        mark,
        ...(shown
          ? {
              preview,
              attempt: {
                ...best,
                positionId: e.id,
                attemptId: `${e.id}:reveal`,
                source: 'activation',
              },
            }
          : {}),
      },
      message: shown
        ? `Solution: ${answer.best_san}. Progress saved as assisted.`
        : mark
          ? 'Move accepted. Progress saved.'
          : 'Not quite. Your first attempt is saved. Try again or show the solution.',
    });
  }
  retry = () => {
    const e = this.state.exercise;
    if (!e || this.running || this.state.phase !== 'wrong') return;
    this.set({
      ...this.state,
      phase: 'ready',
      message: 'Find a better move.',
      exercise: {
        ...e,
        id: `review:${this.gameId}:${++this.revision}`,
        attempt: undefined,
        preview: undefined,
        refutation: undefined,
        principle: undefined,
      },
    });
  };
  hint = async () => {
    const e = this.state.exercise,
      step = this.state.steps[this.state.step];
    if (
      !e ||
      !step ||
      step.type !== 'find' ||
      this.running ||
      this.state.phase !== 'ready' ||
      e.hintLevel >= 2
    )
      return;
    await this.giveHint(
      e,
      step.fen,
      { phase: 'pending', message: 'Loading hint…' },
      async () => (await this.api.hint(this.gameId, step.ply)).best_uci,
    );
  };
  checkAnswer = async () => {
    const e = this.state.exercise,
      step = this.state.steps[this.state.step],
      baseline = this.state.deck;
    if (
      !e ||
      !step ||
      !baseline ||
      this.running ||
      this.state.phase !== 'uncertain'
    )
      return;
    this.running = true;
    try {
      const deck = await this.api.deck();
      if (!this.matches(e)) return;
      const result = deck.results.find(
        (r) => r.game_id === this.gameId && r.ply === step.ply,
      );
      const prior = baseline.results.some(
        (r) => r.game_id === this.gameId && r.ply === step.ply,
      );
      if (
        deck.server_day === baseline.server_day &&
        result &&
        !prior &&
        !e.attempted
      )
        this.set({
          ...this.state,
          phase: 'answered',
          deck,
          exercise: { ...e, attempted: true, mark: result.mark },
          message: 'Saved answer confirmed.',
        });
      else
        this.set({
          ...this.state,
          message:
            'This answer’s outcome is still unknown. Check again or exit; no answer was resent.',
        });
    } catch (error) {
      if (this.matches(e))
        this.set({
          ...this.state,
          message:
            error instanceof Error
              ? error.message
              : 'Could not check progress.',
        });
    } finally {
      this.running = false;
    }
  };
  continue = () => {
    if (this.saving) {
      // The verdict is on screen; move on once its save has landed.
      const at = this.state.step;
      void this.saving.then(() => {
        if (this.state.step === at) this.continue();
      });
      return;
    }
    if (this.running || this.state.view !== 'lesson') return;
    const step = this.state.steps[this.state.step];
    if (!step || this.state.blocked) return;
    const mark =
      step.type === 'praise'
        ? 'praise'
        : step.type === 'look'
          ? 'seen'
          : this.state.phase === 'answered'
            ? this.state.exercise?.mark
            : undefined;
    if (!mark || !['ready', 'answered'].includes(this.state.phase)) return;
    this.set({
      ...this.state,
      marks: [...this.state.marks, { ply: step.ply, mark }],
    });
    this.open(this.state.step + 1);
  };
  finish = async () => {
    // The last answer's save lands before the review is saved.
    if (this.saving) await this.saving;
    if (
      this.running ||
      this.pendingFinish ||
      this.state.blocked ||
      this.state.phase !== 'ready' ||
      this.state.step !== this.state.steps.length ||
      !this.state.game ||
      this.state.marks.length !== this.state.steps.length
    )
      return;
    this.running = true;
    this.pendingFinish = {
      marks: this.state.marks.map((m) => ({ ...m })),
      baseline: this.state.game.reviewed_at,
    };
    this.set({
      ...this.state,
      phase: 'saving',
      message: 'Saving your review…',
    });
    try {
      const result = await this.api.finishReview(this.gameId, {
        marks: this.pendingFinish.marks,
      });
      if (!this.isCurrent()) return;
      this.complete(result.reviewed_at);
    } catch (error) {
      if (!this.isCurrent()) return;
      if (definiteRejection(error)) {
        this.pendingFinish = undefined;
        this.set({
          ...this.state,
          phase: 'ready',
          message:
            error instanceof Error
              ? error.message
              : 'Review was not accepted. Try Finish review again.',
        });
      } else
        this.set({
          ...this.state,
          phase: 'save-uncertain',
          message:
            'Review completion is unconfirmed. Check saved review; this save will not be resent.',
        });
    } finally {
      this.running = false;
    }
  };
  private complete(reviewedAt: string) {
    const marks = this.pendingFinish?.marks ?? this.state.marks;
    this.set({
      ...this.state,
      phase: 'complete',
      exercise: undefined,
      game: this.state.game
        ? { ...this.state.game, reviewed_at: reviewedAt, review_marks: marks }
        : undefined,
      marks,
      message: 'Review complete! Your results are saved.',
    });
    this.pendingFinish = undefined;
    this.onSaved();
  }
  checkFinish = async () => {
    const pending = this.pendingFinish;
    if (!pending || this.running || this.state.phase !== 'save-uncertain')
      return;
    this.running = true;
    try {
      const game = await this.api.game(this.gameId);
      if (!this.isCurrent()) return;
      if (
        game.reviewed_at &&
        game.reviewed_at !== pending.baseline &&
        JSON.stringify(game.review_marks) === JSON.stringify(pending.marks)
      )
        this.complete(game.reviewed_at);
      else
        this.set({
          ...this.state,
          message:
            'This review’s save is still unconfirmed. Check again or exit; no save was resent.',
        });
    } catch (error) {
      this.set({
        ...this.state,
        message:
          error instanceof Error
            ? error.message
            : 'Could not check saved review.',
      });
    } finally {
      this.running = false;
    }
  };
}
