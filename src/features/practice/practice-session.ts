import {
  createTransition,
  type MoveAttempt,
  type MoveVariant,
  type Transition,
} from '../../chess/board';
import type { Principle } from '../../chess/mistake-layers';
import { applyMove, moveFromUci, uciOf } from '../../chess/move';
import { ApiError, serverDetail } from '../../lib/api/api-error';
import type { ApiClient, DeckMode } from '../../lib/api/client';
import {
  type Candidate,
  type CoachExplanation,
  type Deck,
  legalCandidates,
  legalExplanations,
  type PracticeAnswer,
  type PracticeCard,
  type PracticePuzzle,
  type PracticeResult,
  type PracticeStep,
} from '../../lib/api/practice-contract';
import {
  askedFen,
  type ThreatItem,
  threatText,
} from '../../lib/api/threat-contract';
import type { AnswerOutcome } from '../../lib/lesson-points';
import {
  definiteRejection,
  type LessonState,
  LessonStore,
  REPLY_DELAY_MS,
  type Refutation,
  type Schedule,
  schedule,
  thinkingSeconds,
} from '../../lib/lesson-session';
import { gradeLocally, trustedLine } from './local-grade';
import { nextReviewLine, previewLine, savedRating } from './next-review';
import { QUESTION_COPY, type QuestionKind } from './threat-copy';
import { whyNotThreat } from './threat-why';

/** Practice's own phases beside the shared ones. */
type Phase =
  | 'replying'
  | 'hinting'
  | 'revealing'
  | 'checking'
  /** "What do they threaten?": the board takes the opponent's moves. */
  | 'threat'
  /** The threat shown; a card then goes on to its move. */
  | 'threat-shown';
type Setup = {
  fen: string;
  move: MoveVariant;
  applied: ReturnType<typeof applyMove>;
};
/** A position from the learner's own games, or a Lichess puzzle. */
export type PracticeItem =
  | ({ kind: 'card' } & PracticeCard)
  | ({
      kind: 'puzzle';
      /** Why the deck served it (`taught`: the current post's idea, announced). */
      mode?: Deck['mode'];
    } & PracticePuzzle)
  | QuestionItem;
/** A threat question asked on its own: a calm position, one whose move
 * ignored a threat but is no review card, what your move allowed, or a loose
 * piece to take. `ask` is the item's kind. */
type QuestionItem = { kind: 'question'; ask: QuestionKind } & Omit<
  ThreatItem,
  'kind'
> & { feedback?: undefined; line?: undefined };
/** What the threat step of `item` asks: a card's is always `threat`. */
export const questionKind = (item: PracticeItem): QuestionKind =>
  item.kind === 'question' ? item.ask : 'threat';
/** The position a threat step is answered from, and whose pieces move there. */
export function questionBoard(item: PracticeItem): {
  fen: string;
  side: 'w' | 'b';
} {
  const kind = questionKind(item);
  const yours = item.color === 'white' ? 'w' : 'b';
  return {
    fen: askedFen({ kind, fen_before: item.fen_before }),
    // Your own capture for a loose piece; their move for every other kind.
    side: kind === 'vision' ? yours : yours === 'w' ? 'b' : 'w',
  };
}
type Threat = ThreatItem['threats'][number];
export const NO_THREAT = 'none';
/** A solution line with the position after each of its moves. */
type Line = { uci: string[]; san: string[]; fens: string[] };
export type Exercise = {
  item: PracticeItem;
  /** The opponent's last move, played in before the learner may answer. */
  setup?: Setup;
  entered: boolean;
  /** Moves the server accepted, from the item's position: learner and opponent. */
  played: string[];
  /** The position to answer now, after `played`. */
  fen: string;
  /** The move into `fen`, and how it plays in. */
  lastMove?: MoveVariant;
  transition?: Transition;
  /** The saved grade of the latest answer. */
  quality?: PracticeAnswer['quality'];
  positionId: string;
  /** Thinking time so far (ms), and when the current position became playable. */
  thought: number;
  since: number;
  /** Shown in place of a verdict sheet (Continue, Try again, Find your
   * move), whose button sits over Hint and Solution: those wait SETTLE_MS. */
  guarded?: boolean;
  hinted: boolean;
  acknowledged?: boolean;
  hint?: string;
  hintLevel: number;
  attempt?: MoveAttempt;
  preview?: string;
  /** The full solution, known once the answer has finished. */
  line?: Line;
  /** The line position on the board while revealing or stepping: plies played. */
  view?: number;
  /** Slides the previous position's pieces into this one, as Lichess does. */
  arrival: Transition;
  /** The served solution, when trusted: moves and hints are judged from it. */
  solution?: string[];
  /** After a wrong first move with an explanation: the board after the
   * opponent's punishing reply, shown before the verdict. */
  refutation?: Refutation;
  /** Why the solution works, once the answer has finished. */
  why?: string;
  /** When the position comes back, after the day's graded answer only. */
  nextReview?: string;
  /** The habit a wrong first move points to (blunder causes). */
  principle?: Principle;
  /** The top moves with a reason each, once answered or shown. */
  candidates?: readonly Candidate[];
  /** Known after a miss, shown only with the solution. */
  heldCandidates?: readonly Candidate[];
  /** A top move's line playing on the board, tapped from Why?: plies shown. */
  candidate?: { uci: string; fens: string[]; moves: string[]; view: number };
  /** "What do they threaten?" before the move (or on its own): the threats,
   * and the answer once given. */
  threat?: {
    threats: readonly Threat[];
    answer?: string;
    correct?: boolean;
  };
};
export type PracticeState = LessonState<Exercise, Phase> & {
  deck?: Deck;
};
const itemKey = (item: PracticeItem) =>
  item.kind === 'card'
    ? `${item.game_id}:${item.ply}`
    : item.kind === 'question'
      ? `question:${item.game_id}:${item.ply}`
      : `puzzle:${item.id}`;
// Chess.com plays the setup move a moment after the puzzle appears, replies
// about REPLY_DELAY_MS after a correct move and plays a solution at 800 ms a move.
const SETUP_DELAY_MS = 350;
/** How long a server-graded answer may take before it counts as uncertain. */
export const ANSWER_TIMEOUT_MS = 12_000;
const REVEAL_STEP_MS = 800;
// A repeated press on a verdict's button lands on the bar beneath it once the
// sheet has gone; Hint and Solution ignore presses this soon after.
const SETTLE_MS = 1000;
const placement = (fen: string) => fen.split(' ')[0];
/** The opponent's move into the item, when it replays onto the item's position. */
function setupOf(item: PracticeItem): Setup | undefined {
  if (!item.fen_prev || !item.prev_uci) return undefined;
  try {
    const move = moveFromUci(item.prev_uci);
    const applied = applyMove(item.fen_prev, move);
    if (placement(applied.fen) !== placement(item.fen_before)) return undefined;
    return { fen: item.fen_prev, move, applied };
  } catch {
    return undefined;
  }
}
/** Replays a server line from the item's position; throws if any move is illegal. */
function lineOf(fen: string, line: PracticeResult['line']): Line {
  const fens = [fen];
  for (const uci of line.uci)
    fens.push(applyMove(fens[fens.length - 1] ?? fen, moveFromUci(uci)).fen);
  return { uci: line.uci, san: line.san, fens };
}
/** What the coach asks before the first try at a review card: a leech (missed
 * again and again) says so and points at their threats first. */
export const cardPrompt = (card: {
  san: string;
  leech?: boolean;
  lapses?: number;
  unannounced?: 'critical' | 'calm';
}) =>
  card.unannounced
    ? 'Your move.'
    : card.leech && card.lapses
      ? `You've missed this ${card.lapses} times. Look at what they threaten first.`
      : `You played ${card.san} here. Find a better move.`;

/** A "Your move" verdict: which kind of position it was, said only after the
 * answer, so the learner learns whether there was anything to notice. */
export const yourMoveVerdict = (kind: 'critical' | 'calm', correct: boolean) =>
  kind === 'critical'
    ? correct
      ? {
          title: 'Found it',
          body: 'There was something here, and you found it.',
        }
      : { title: 'Not quite', body: 'There was something here.' }
    : correct
      ? { title: 'Safe move', body: 'Quiet position: any safe move was fine.' }
      : {
          title: 'Not quite',
          body: 'Quiet position, but that move gives something away.',
        };

/** The worker's coaching for an item, when it has prepared some. */
const coachingOf = (item: PracticeItem) => item.feedback ?? undefined;
/** The explanation for a wrong first move: the server's, else the served one,
 * kept only when its reply is legal after the move. */
function explanationOf(
  exercise: Exercise,
  uci: string,
  fromServer: CoachExplanation | null | undefined,
) {
  const served = coachingOf(exercise.item)?.explanations?.[uci];
  const explanation = fromServer ?? served;
  if (!explanation) return undefined;
  return legalExplanations(exercise.item.fen_before, { [uci]: explanation })[
    uci
  ];
}

// One controller per authenticated scope. No persisted cards or mutation queue.
export class PracticeSession extends LessonStore<
  Exercise,
  Phase,
  PracticeState
> {
  private revision = 0;
  /** Finished answers saving in the background, one at a time in order. */
  private saves: Promise<void> = Promise.resolve();
  /** Set when a background save failed: later saves of that item are not sent. */
  private saveFailed?: string;
  /** The next deck, fetched once the latest answer was saved. */
  private prefetched?: Promise<Deck | undefined>;
  /** That deck once it has arrived: Continue opens it without a loading frame. */
  private ready?: Deck;
  constructor(
    private api: Pick<
      ApiClient,
      | 'deck'
      | 'extraWatch'
      | 'answerLine'
      | 'lineHint'
      | 'puzzleAnswer'
      | 'puzzleHint'
      | 'threatAnswer'
      | 'unannouncedAnswer'
    > &
      Partial<Pick<ApiClient, 'lessonIntroduced' | 'startChallenge'>>,
    isCurrent: () => boolean,
    private onDeck: (deck: Deck) => void = () => {},
    private now = () => Date.now(),
    private onSaved: () => void = () => {},
    run: Schedule = schedule,
    /** `lesson` (the daily lesson) ends when the server says so. `extra` (an
     * extra watch) and `challenge` (the post's test) likewise, started (or
     * resumed) on the server by the visit that opens them. */
    private mode: DeckMode = 'lesson',
  ) {
    super(
      { phase: 'loading', message: 'Loading today’s practice…' },
      isCurrent,
      run,
    );
  }
  /** Marks a lesson's intro seen (intros.py). Best effort: if it fails, the
   * next visit offers the intro again. */
  introduced(key: string) {
    void this.api.lessonIntroduced?.(key).catch(() => {});
  }
  /** Whether this visit's extra watch or post test was started (or resumed)
   * on the server. */
  private extraStarted = false;
  private async fetchDeck() {
    if (this.mode === 'extra' && !this.extraStarted) {
      const deck = await this.api.extraWatch();
      this.extraStarted = true;
      return deck;
    }
    if (
      this.mode === 'challenge' &&
      !this.extraStarted &&
      this.api.startChallenge
    ) {
      const deck = await this.api.startChallenge();
      this.extraStarted = true;
      return deck;
    }
    return this.api.deck(undefined, this.mode);
  }
  private nextId(item: PracticeItem) {
    return `practice:${++this.revision}:${itemKey(item)}`;
  }
  private open(item: PracticeItem, deck: Deck, guarded = false) {
    const setup = setupOf(item);
    const positionId = this.nextId(item);
    this.saveFailed = undefined;
    const solution = trustedLine(item.fen_before, item.line);
    const arrival = createTransition({
      id: `${positionId}:arrive`,
      positionId: setup ? `${positionId}:setup` : positionId,
      reason: 'morph',
    });
    // The threat question comes first.
    const threats =
      item.kind === 'question'
        ? item.threats
        : item.kind === 'card'
          ? item.threat?.threats
          : undefined;
    this.set({
      phase: threats ? 'threat' : 'ready',
      combo: this.state.combo,
      message: threats
        ? QUESTION_COPY[questionKind(item)].title
        : item.kind === 'card'
          ? item.unannounced
            ? 'Your move.'
            : 'Find a better move.'
          : 'Find the best move.',
      deck,
      exercise: {
        item,
        positionId,
        played: [],
        fen: item.fen_before,
        thought: 0,
        since: this.now(),
        hinted: false,
        hintLevel: 0,
        arrival,
        ...(guarded ? { guarded } : {}),
        ...(threats ? { threat: { threats } } : {}),
        ...(solution ? { solution } : {}),
        ...(setup
          ? {
              setup,
              lastMove: setup.move,
              transition: createTransition(
                { id: `${positionId}:setup`, positionId, reason: 'opponent' },
                setup.applied,
              ),
            }
          : {}),
        entered: !setup,
      },
    });
    const opened = this.state.exercise;
    if (setup && opened)
      this.schedule(SETUP_DELAY_MS, () => this.enter(opened));
  }
  /** Plays the opponent's move in; the learner can answer from then on. */
  private enter(exercise: Exercise) {
    if (!this.matches(exercise) || exercise.entered) return;
    this.set({
      ...this.state,
      exercise: { ...exercise, entered: true, since: this.now() },
    });
  }
  load = async () => {
    if (this.running || !this.isCurrent()) return;
    // Returning to a session retains its attempt, including an uncertain save.
    if (!['loading', 'error', 'complete'].includes(this.state.phase)) return;
    // Coming back to a finished extra watch takes the next one.
    if (this.state.phase === 'complete') this.extraStarted = false;
    this.running = true;
    try {
      await this.openNext('Loading today’s practice…');
    } finally {
      this.running = false;
    }
  };
  /** Opens the deck's next item: at once from a prefetched deck that has
   * arrived, otherwise after a loading frame that keeps the last board. */
  private async openNext(loading: string, guarded = false) {
    const ready = this.ready;
    if (ready) this.dropPrefetch();
    else
      this.set({
        ...this.state,
        exercise: undefined,
        phase: 'loading',
        message: loading,
      });
    try {
      const deck =
        ready ?? (await this.takePrefetched()) ?? (await this.fetchDeck());
      if (!this.isCurrent()) return;
      this.onDeck(deck);
      if (deck.card) this.open({ kind: 'card', ...deck.card }, deck, guarded);
      else if (deck.threat_item)
        this.open(
          {
            ...deck.threat_item,
            kind: 'question',
            ask: deck.threat_item.kind,
          },
          deck,
          guarded,
        );
      else if (deck.unannounced_item)
        this.open({ kind: 'card', ...deck.unannounced_item }, deck, guarded);
      else if (deck.puzzle)
        this.open(
          {
            kind: 'puzzle',
            ...deck.puzzle,
            // Why it was served: `taught` is the current post's idea, announced.
            mode: deck.mode ?? null,
          },
          deck,
          guarded,
        );
      else
        this.set({
          phase: 'complete',
          deck,
          message:
            this.mode === 'lesson'
              ? deck.lesson?.total && deck.lesson.done >= deck.lesson.total
                ? 'Lesson complete'
                : 'Nothing to answer right now'
              : this.mode === 'challenge'
                ? deck.challenge?.passed
                  ? 'Post cleared'
                  : deck.challenge?.passed === false
                    ? 'Not this time'
                    : 'Nothing to answer right now'
                : deck.extra?.done
                  ? 'Extra watch complete'
                  : 'Nothing to answer right now',
        });
    } catch (error) {
      this.set({
        ...this.state,
        phase: 'error',
        message:
          error instanceof Error ? error.message : 'Could not load practice.',
      });
    }
  }
  /** A press on Hint or Solution that came too soon after a verdict sheet
   * closed over them: meant for that sheet, not for this position. */
  private settling(exercise: Exercise) {
    return (
      this.state.phase === 'ready' &&
      exercise.guarded === true &&
      this.now() - exercise.since < SETTLE_MS
    );
  }
  attempt = async (attempt: MoveAttempt) => {
    const exercise = this.state.exercise;
    if (this.state.phase === 'threat') {
      if (exercise?.entered && attempt.positionId === exercise.positionId)
        this.answerThreat(uciOf(attempt));
      return;
    }
    if (
      !exercise?.entered ||
      this.running ||
      this.state.phase !== 'ready' ||
      attempt.positionId !== exercise.positionId
    )
      return;
    let preview: string;
    try {
      preview = applyMove(exercise.fen, attempt).fen;
    } catch {
      return;
    }
    await this.submit(
      {
        ...exercise,
        attempt,
        preview,
        thought: exercise.thought + (this.now() - exercise.since),
      },
      uciOf(attempt),
    );
  };
  reveal = async () => {
    const exercise = this.state.exercise;
    if (
      !exercise?.entered ||
      this.running ||
      !['ready', 'wrong'].includes(this.state.phase) ||
      this.settling(exercise)
    )
      return;
    // After a miss the line is known and the miss is saved: just play it.
    if (this.state.phase === 'wrong' && exercise.line) {
      const { heldCandidates: candidates, ...rest } = exercise;
      this.replay(
        { ...rest, hinted: true, ...(candidates ? { candidates } : {}) },
        `The line is ${exercise.line.san.join(' ')}.`,
      );
      return;
    }
    await this.submit({ ...exercise, hinted: true }, '0000');
  };
  /** Shows the whole line from the start, one move every REVEAL_STEP_MS. */
  private replay(exercise: Exercise, message: string, combo = 0) {
    this.set({
      ...this.state,
      combo,
      phase: 'revealing',
      message,
      exercise: {
        ...exercise,
        positionId: this.nextId(exercise.item),
        attempt: undefined,
        preview: undefined,
        hint: undefined,
        refutation: undefined,
        view: 0,
      },
    });
    this.frame(this.state.exercise);
  }
  private frame(exercise: Exercise | undefined) {
    if (!exercise?.line) return;
    const line = exercise.line;
    this.schedule(REVEAL_STEP_MS, () => {
      if (!this.matches(exercise) || this.state.phase !== 'revealing') return;
      const view = (exercise.view ?? 0) + 1;
      const done = view >= line.uci.length;
      this.set({
        ...this.state,
        phase: done ? 'answered' : 'revealing',
        exercise: { ...exercise, view },
      });
      if (!done) this.frame(this.state.exercise);
    });
  }
  private async takePrefetched() {
    const next = this.prefetched;
    this.dropPrefetch();
    return next ? await next : undefined;
  }
  private dropPrefetch() {
    this.prefetched = undefined;
    this.ready = undefined;
  }
  /** Fetches the deck after a saved answer, so Continue needn't wait for it. */
  private prefetch() {
    this.ready = undefined;
    const next: Promise<Deck | undefined> = this.fetchDeck()
      .then((deck) => {
        if (this.prefetched === next) this.ready = deck;
        return deck;
      })
      .catch(() => undefined);
    this.prefetched = next;
  }
  /** Sends a move list to the answer endpoint for the exercise's item. */
  /** Sends an answer. A stalled request gives up after ANSWER_TIMEOUT_MS
   * rather than spin: its outcome becomes uncertain, which checks saved
   * progress and never resends. */
  private post(exercise: Exercise, moves: string[], deck: Deck) {
    const { item } = exercise;
    // A threat question has no move to submit; it never reaches here.
    if (item.kind === 'question') return Promise.reject(new Error('No move'));
    const stall = new AbortController();
    const timer = setTimeout(() => stall.abort(), ANSWER_TIMEOUT_MS);
    const sent =
      item.kind === 'card' && item.unannounced
        ? this.api.unannouncedAnswer(
            {
              expected_day: deck.server_day,
              game_id: item.game_id,
              ply: item.ply,
              moves,
              hinted: exercise.hinted,
              seconds: thinkingSeconds(exercise.thought),
            },
            stall.signal,
          )
        : item.kind === 'card'
          ? this.api.answerLine(
              {
                expected_day: deck.server_day,
                game_id: item.game_id,
                ply: item.ply,
                moves,
                line_key: item.line_key,
                hinted: exercise.hinted,
                redo: false,
                seconds: thinkingSeconds(exercise.thought),
              },
              stall.signal,
            )
          : this.api.puzzleAnswer(
              {
                expected_day: deck.server_day,
                id: item.id,
                moves,
                line_key: item.line_key,
                hinted: exercise.hinted,
                redo: false,
              },
              stall.signal,
            );
    return sent.finally(() => clearTimeout(timer));
  }
  /** Answers from the served solution at once: a continuing move plays the
   * reply in, a finished one shows its verdict and saves in the background. */
  private answerLocally(
    exercise: Exercise,
    uci: string,
    moves: string[],
    result: PracticeStep,
  ) {
    this.set({ ...this.state, exercise });
    if (result.status === 'continue') {
      const applied = applyMove(
        exercise.preview ?? exercise.fen,
        moveFromUci(result.reply_uci),
      );
      this.set({ ...this.state, phase: 'replying', message: 'Correct!' });
      const replying = this.state.exercise;
      if (replying)
        this.schedule(REPLY_DELAY_MS, () =>
          this.reply(replying, result.reply_uci, applied, moves),
        );
      return;
    }
    const combo = this.state.combo;
    this.finish(exercise, uci, result);
    this.save(exercise, uci, moves, result, combo);
  }
  private save(
    exercise: Exercise,
    uci: string,
    moves: string[],
    shown: PracticeResult,
    combo: number | undefined,
  ) {
    const deck = this.state.deck;
    if (!deck) return;
    const key = itemKey(exercise.item);
    this.dropPrefetch();
    this.saves = this.saves.then(async () => {
      if (this.saveFailed === key || !this.isCurrent()) return;
      try {
        const saved = await this.post(exercise, moves, deck);
        if (!this.isCurrent()) return;
        if (saved.status === 'continue')
          throw new Error('The saved answer did not match this position.');
        this.onSaved();
        const current = this.state.exercise;
        // A stale map or line: the server's verdict replaces the one shown.
        if (
          (saved.correct !== shown.correct ||
            saved.quality !== shown.quality) &&
          current?.positionId === exercise.positionId &&
          ['answered', 'wrong', 'refuting'].includes(this.state.phase)
        ) {
          this.state = { ...this.state, combo };
          this.finish(exercise, uci, saved);
        } else if (current?.positionId === exercise.positionId) {
          // The saved date wins over the served preview's, and fills the line
          // in for a card served without one.
          const nextReview = this.nextReview(exercise, saved);
          if (
            nextReview &&
            nextReview !== current.nextReview &&
            ['answered', 'wrong'].includes(this.state.phase)
          )
            this.set({
              ...this.state,
              exercise: { ...current, nextReview },
            });
        }
        this.prefetch();
      } catch (error) {
        this.saveFailed = key;
        this.failed(exercise, error);
      }
    });
  }
  /** A save that failed: the attempt goes back on screen with the usual
   * recovery (reload, a rejected move, or check saved progress). */
  private failed(exercise: Exercise, error: unknown) {
    if (!this.isCurrent()) return;
    if (error instanceof ApiError && error.status === 409) {
      // The server says which it was: the position's line changed, or the
      // practice day ended under the open card.
      const reason = serverDetail(error);
      this.set({
        phase: 'error',
        message: reason
          ? `${reason} Your saved progress is safe.`
          : 'This position changed or a new practice day started. Reload practice.',
      });
    } else if (definiteRejection(error)) {
      this.set({
        ...this.state,
        exercise,
        phase: 'wrong',
        message: `${error.message} The move was not accepted; restore the position to try again.`,
      });
    } else
      this.set({
        ...this.state,
        exercise,
        phase: 'uncertain',
        message:
          'The save could not be confirmed. Check saved progress before continuing; this answer will not be resent.',
      });
  }
  private async submit(exercise: Exercise, uci: string) {
    const deck = this.state.deck;
    if (!deck) return;
    const moves = [...exercise.played, uci];
    const { item } = exercise;
    if (item.kind === 'question') return;
    const local =
      exercise.solution &&
      gradeLocally({
        fen: item.fen_before,
        line: exercise.solution,
        moves,
        hinted: exercise.hinted,
        kind: item.kind,
        grades: item.kind === 'card' ? item.feedback?.grades : undefined,
      });
    if (local) {
      this.answerLocally(exercise, uci, moves, local);
      return;
    }
    this.running = true;
    this.dropPrefetch();
    this.set({
      ...this.state,
      exercise,
      phase: 'pending',
      message: 'Checking your move…',
    });
    const sent = this.now();
    try {
      const result: PracticeStep = await this.post(exercise, moves, deck);
      if (!this.matches(exercise)) return;
      if (result.status === 'continue') {
        // An illegal reply is malformed success data: the outcome is unknown.
        const applied = applyMove(
          exercise.preview ?? exercise.fen,
          moveFromUci(result.reply_uci),
        );
        this.set({ ...this.state, phase: 'replying', message: 'Correct!' });
        const replying = this.state.exercise;
        if (replying)
          this.schedule(Math.max(0, REPLY_DELAY_MS - (this.now() - sent)), () =>
            this.reply(replying, result.reply_uci, applied, moves),
          );
        return;
      }
      this.finish(exercise, uci, result);
      this.onSaved();
      this.prefetch();
    } catch (error) {
      if (!this.matches(exercise)) return;
      this.failed(exercise, error);
    } finally {
      this.running = false;
    }
  }
  /** Applies a finished answer: validates its line, then shows the outcome. */
  private finish(exercise: Exercise, uci: string, result: PracticeResult) {
    // Reject an unrelated or illegal solution even when the JSON shape was valid.
    const line = lineOf(exercise.item.fen_before, result.line);
    const accepted = line.uci.slice(0, exercise.played.length);
    if (
      accepted.join(' ') !== exercise.played.join(' ') ||
      result.step * 2 !== exercise.played.length
    )
      throw new Error('The solution does not follow the accepted moves.');
    const saved = exercise.item.kind === 'card' ? ' Progress saved.' : '';
    const message =
      result.quality === 'shown'
        ? `The line is ${line.san.join(' ')}.${exercise.item.kind === 'card' ? ' Progress saved as assisted.' : ''}`
        : result.correct
          ? exercise.acknowledged
            ? 'Found it. Your original grade is unchanged.'
            : result.rating === 'again' || exercise.hinted
              ? `Found it with help.${saved}`
              : result.quality === 'good'
                ? `Good move. Best was ${result.best_san}.${saved}`
                : `Found it!${saved}`
          : exercise.acknowledged
            ? `The move was ${result.best_san}. Try again.`
            : 'Your first attempt is saved. Try again, with a hint if you need one.';
    const why =
      result.why?.why_text ?? coachingOf(exercise.item)?.why?.why_text;
    const nextReview = this.nextReview(exercise, result);
    const { principle: _stale, nextReview: _shown, ...rest } = exercise;
    // Candidates are part of the answer: hidden until it is found or shown.
    const candidates = legalCandidates(
      exercise.item.fen_before,
      result.candidates ?? coachingOf(exercise.item)?.candidates,
    );
    const finished: Exercise = {
      ...rest,
      acknowledged: true,
      quality: result.quality,
      line,
      ...(nextReview ? { nextReview } : {}),
      ...(why && result.status !== 'failed' ? { why } : {}),
      ...(candidates.length
        ? result.status === 'failed'
          ? { heldCandidates: candidates }
          : { candidates }
        : {}),
    };
    const clean =
      result.correct &&
      result.quality !== 'shown' &&
      result.rating !== 'again' &&
      !exercise.hinted &&
      !exercise.acknowledged;
    const combo = clean ? (this.state.combo ?? 0) + 1 : 0;
    // Every finished position is recorded, misses as 0, so a session with
    // a miss is never perfect.
    const outcome: AnswerOutcome =
      !result.correct || result.quality === 'shown'
        ? 'none'
        : clean
          ? 'clean'
          : 'helped';
    this.score(
      exercise.positionId,
      outcome,
      outcome === 'clean' ? combo : 0,
      uci,
    );
    if (uci === '0000') {
      this.replay(finished, message, combo);
      return;
    }
    const explanation =
      result.status === 'failed' && !exercise.played.length
        ? explanationOf(exercise, uci, result.explanation)
        : undefined;
    if (explanation && exercise.preview) {
      this.refute(finished, explanation, exercise.preview, {
        combo,
        // Never a blank bubble while their reply plays.
        message: 'Watch their reply.',
        nextId: (refuting) => this.nextId(refuting.item),
      });
      return;
    }
    this.set({
      ...this.state,
      combo,
      exercise: finished,
      phase: result.correct ? 'answered' : 'wrong',
      message,
    });
  }
  /** The day's graded answer of a card: when it comes back. The saved answer's
   * date wins; an instant answer reads it from the card's served preview. */
  private nextReview(exercise: Exercise, result: PracticeResult) {
    const { item } = exercise;
    const today = this.state.deck?.server_day;
    if (
      item.kind !== 'card' ||
      !today ||
      !result.rating ||
      exercise.acknowledged
    )
      return undefined;
    if (result.due)
      return nextReviewLine({
        rating: result.rating,
        due: result.due,
        today,
        mastered: result.mastered,
        wasMastered: item.mastered ?? false,
      });
    const rating = exercise.hinted
      ? result.rating
      : savedRating(
          result.rating,
          result.quality,
          result.step + 1,
          thinkingSeconds(exercise.thought),
        );
    return previewLine(item, rating, today);
  }
  /** Plays the opponent's reply in; the learner continues from there. */
  private reply(
    exercise: Exercise,
    uci: string,
    applied: ReturnType<typeof applyMove>,
    moves: string[],
  ) {
    if (!this.matches(exercise) || this.state.phase !== 'replying') return;
    const positionId = this.nextId(exercise.item);
    this.set({
      ...this.state,
      phase: 'ready',
      message: 'Keep going. Find the next move.',
      exercise: {
        ...exercise,
        played: [...moves, uci],
        fen: applied.fen,
        positionId,
        lastMove: moveFromUci(uci),
        transition: createTransition(
          { id: `${positionId}:reply`, positionId, reason: 'opponent' },
          applied,
        ),
        attempt: undefined,
        preview: undefined,
        hint: undefined,
        hintLevel: 0,
        since: this.now(),
      },
    });
  }
  retry = () => {
    const exercise = this.state.exercise;
    if (!exercise || this.running || this.state.phase !== 'wrong') return;
    // Chess.com takes back only the wrong move: the accepted moves stay.
    this.set({
      ...this.state,
      phase: 'ready',
      message: exercise.acknowledged
        ? 'Try again. Your original grade stays the same.'
        : 'Try again.',
      exercise: {
        ...exercise,
        positionId: this.nextId(exercise.item),
        attempt: undefined,
        preview: undefined,
        transition: undefined,
        view: undefined,
        refutation: undefined,
        since: this.now(),
        guarded: true,
      },
    });
  };
  /** Steps through the line after an answer: ‹ (-1) and › (+1). */
  step = (delta: -1 | 1) => {
    const exercise = this.state.exercise;
    const line = exercise?.line;
    if (!exercise || !line || this.state.phase !== 'answered') return;
    const from = exercise.view ?? line.uci.length;
    const view = Math.min(line.uci.length, Math.max(0, from + delta));
    if (view === from && !exercise.candidate) return;
    this.set({
      ...this.state,
      exercise: { ...exercise, view, candidate: undefined },
    });
  };
  /** Plays a top move's line from the position, one move every
   * REVEAL_STEP_MS as the solution does; undefined goes back to the line. */
  playCandidate = (uci: string | undefined) => {
    const exercise = this.state.exercise;
    if (!exercise || this.state.phase !== 'answered') return;
    const chosen = uci
      ? exercise.candidates?.find((c) => c.uci === uci)
      : undefined;
    if (!chosen) {
      if (exercise.candidate)
        this.set({
          ...this.state,
          exercise: { ...exercise, candidate: undefined },
        });
      return;
    }
    const fens = [exercise.item.fen_before];
    try {
      for (const move of chosen.line)
        fens.push(
          applyMove(fens[fens.length - 1] ?? '', moveFromUci(move)).fen,
        );
    } catch {
      return;
    }
    this.set({
      ...this.state,
      exercise: {
        ...exercise,
        candidate: { uci: chosen.uci, fens, moves: chosen.line, view: 0 },
      },
    });
    this.candidateFrame(this.state.exercise);
  };
  private candidateFrame(exercise: Exercise | undefined) {
    const playing = exercise?.candidate;
    if (!exercise || !playing || playing.view >= playing.moves.length) return;
    this.schedule(REVEAL_STEP_MS, () => {
      if (!this.matches(exercise) || this.state.phase !== 'answered') return;
      this.set({
        ...this.state,
        exercise: {
          ...exercise,
          candidate: { ...playing, view: playing.view + 1 },
        },
      });
      this.candidateFrame(this.state.exercise);
    });
  }
  hint = async () => {
    const exercise = this.state.exercise;
    if (
      !exercise?.entered ||
      exercise.item.kind === 'question' ||
      // A hint would say there is something to find.
      (exercise.item.kind === 'card' && !!exercise.item.unannounced) ||
      this.running ||
      this.state.phase !== 'ready' ||
      exercise.hintLevel >= 2 ||
      this.settling(exercise)
    )
      return;
    const { item } = exercise;
    await this.giveHint(
      exercise,
      exercise.fen,
      { phase: 'hinting', message: 'Loading a hint…' },
      async () =>
        // The served solution gives the hint at once; the server only without one.
        exercise.solution?.[exercise.played.length] ??
        (item.kind === 'card'
          ? await this.api.lineHint({
              game_id: item.game_id,
              ply: item.ply,
              moves: exercise.played,
              line_key: item.line_key,
            })
          : await this.api.puzzleHint({
              id: item.id,
              moves: exercise.played,
              line_key: item.line_key,
            })
        ).best_uci,
    );
  };
  checkSaved = async () => {
    const exercise = this.state.exercise;
    if (!exercise || this.running || this.state.phase !== 'uncertain') return;
    this.running = true;
    this.set({
      ...this.state,
      phase: 'checking',
      message: 'Checking saved progress…',
    });
    const markIn = (deck: Deck | undefined) => {
      const item = exercise.item;
      if (item.kind === 'question') return undefined;
      if (item.kind === 'card')
        return deck?.results.find(
          (r) => r.game_id === item.game_id && r.ply === item.ply,
        )?.mark;
      const found = deck?.puzzle_results?.find((r) => r.id === item.id);
      return found && (found.correct ? 'found' : 'missed');
    };
    try {
      const deck = await this.fetchDeck();
      if (!this.matches(exercise)) return;
      this.onDeck(deck);
      if (deck.server_day !== this.state.deck?.server_day) {
        this.set({
          phase: 'error',
          message: 'A new practice day has started. Reload practice.',
        });
      } else {
        const mark = markIn(deck);
        // A retry already has a result before its POST: it cannot reconcile a lost response.
        const prior = markIn(this.state.deck);
        if (mark && !prior && !exercise.acknowledged) {
          this.set({
            ...this.state,
            deck,
            phase: 'answered',
            message: `Saved progress confirmed: ${mark}. Continue to the next position.`,
          });
          this.onSaved();
        } else
          this.set({
            ...this.state,
            phase: 'uncertain',
            message:
              'This request’s outcome is still unknown. Check again or exit; no answer has been resent.',
          });
      }
    } catch (error) {
      if (this.matches(exercise))
        this.set({
          ...this.state,
          phase: 'uncertain',
          message:
            error instanceof Error
              ? error.message
              : 'Could not check saved progress.',
        });
    } finally {
      this.running = false;
    }
  };
  /** Whether this exercise is finished and Continue may load the next one. */
  private finished() {
    const { phase, exercise } = this.state;
    return (
      phase === 'answered' ||
      (phase === 'threat-shown' && exercise?.item.kind === 'question')
    );
  }
  /** Answers the threat question: a move of theirs, or No threat. Judged at
   * once from the served threats and saved in the background; a failed save
   * is reported, never resent (the position stays due and comes back). */
  answerThreat = (given: string) => {
    const exercise = this.state.exercise;
    const deck = this.state.deck;
    const threat = exercise?.threat;
    if (
      !exercise?.entered ||
      !threat ||
      !deck ||
      this.state.phase !== 'threat' ||
      exercise.item.kind === 'puzzle'
    )
      return;
    const first = threat.threats[0];
    const correct = first
      ? threat.threats.some((t) => t.uci === given)
      : given === NO_THREAT;
    const shown: Exercise = {
      ...exercise,
      threat: { ...threat, answer: given, correct },
    };
    // Why the move played is not their threat, so a wrong answer teaches the
    // definition: it has to win material once you reply. A loose piece to take
    // is your own move: there is no "them" to explain.
    const kind = questionKind(exercise.item);
    const why =
      !correct && given !== NO_THREAT && kind !== 'vision'
        ? whyNotThreat(questionBoard(exercise.item).fen, given)
        : undefined;
    this.set({
      ...this.state,
      phase: 'threat-shown',
      message: correct
        ? first
          ? `Yes: ${threatText(first)}.`
          : 'Right: nothing is threatened here.'
        : [
            why,
            first
              ? why
                ? `${QUESTION_COPY[kind].answer}: ${threatText(first)}.`
                : `Missed: ${threatText(first)}.`
              : 'Nothing here wins material for them.',
          ]
            .filter(Boolean)
            .join(' '),
      exercise: shown,
    });
    const { game_id, ply } = exercise.item;
    this.dropPrefetch();
    const saving = this.api
      .threatAnswer({
        game_id,
        ply,
        answer: given,
        seconds: thinkingSeconds(this.now() - exercise.since),
        expected_day: deck.server_day,
      })
      .then(() => {
        const current = this.state.exercise;
        if (
          current?.positionId === exercise.positionId &&
          current.item.kind === 'question'
        )
          this.set({
            ...this.state,
            exercise: { ...current, acknowledged: true },
          });
        this.onSaved();
        // A card still has its move to answer; a question is done.
        if (exercise.item.kind === 'question' && this.isCurrent())
          this.prefetch();
      })
      .catch(() => {
        if (this.state.exercise?.positionId === exercise.positionId)
          this.set({
            ...this.state,
            message: `${this.state.message} This answer didn’t save, so it will come back.`,
          });
      });
    this.saves = this.saves.then(() => saving);
  };
  /** After the threat question on a card: on to finding the move. */
  findMove = () => {
    const exercise = this.state.exercise;
    if (
      !exercise ||
      this.state.phase !== 'threat-shown' ||
      exercise.item.kind !== 'card'
    )
      return;
    const positionId = this.nextId(exercise.item);
    this.set({
      ...this.state,
      phase: 'ready',
      message: 'Find a better move.',
      exercise: {
        ...exercise,
        positionId,
        transition: undefined,
        since: this.now(),
        guarded: true,
      },
    });
  };
  next = async () => {
    if (this.running || !this.finished()) return;
    // The answer may still be saving: the next position waits for it.
    this.running = true;
    try {
      await this.saves;
    } finally {
      this.running = false;
    }
    // A failed save brought its attempt back with its recovery instead.
    if (!this.finished()) return;
    this.running = true;
    try {
      await this.openNext('Loading the next position…', true);
    } finally {
      this.running = false;
    }
  };
}
