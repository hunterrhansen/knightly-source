import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type BoardProps,
  createTransition,
  type MoveAttempt,
  type MoveVariant,
} from '../../chess/board';
import { applyMove, legalMoves, moveFromUci } from '../../chess/move';
import type {
  IntroExercise,
  LessonIntro,
} from '../../lib/api/practice-contract';
import type { ActionIconName } from '../../ui';
import { introCopy } from './lesson-intro-copy';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// A lesson's intro (issue #326), the Steps Method's order of teaching: the
// knight explains, the wall demonstrates, then the learner's first try. Its
// guided move is judged here and never sent to the server, so it never counts
// toward holding the lesson.

/** Milliseconds between the demonstration's moves; faster with reduced motion. */
const DEMO_STEP_MS = 700;
const DEMO_STEP_REDUCED_MS = 250;
/** The opponent's move into the learner's position, and a reply in the line. */
const SETUP_MS = 500;
const REPLY_MS = 280;
/** Think first: the piece to move is marked only after this, or on Hint. */
const THINK_MS = 2000;

type Step = 'explain' | 'demo' | 'try' | 'right' | 'wrong';

/** One move of a line on the board: the position after it and how it got there. */
type Ply = {
  fen: string;
  move: MoveVariant;
  motions: ReturnType<typeof applyMove>;
};

/** The positions a line passes through from `fen_prev`: the opponent's move
 * in, then every move of the line. Index 0 is the starting position. */
export function linePositions(ex: IntroExercise): { fen: string; ply?: Ply }[] {
  const out: { fen: string; ply?: Ply }[] = [{ fen: ex.fen_prev }];
  let from = ex.fen_prev;
  for (const uci of [ex.prev_uci, ...ex.line]) {
    const move = moveFromUci(uci);
    const applied = applyMove(from, move);
    from = applied.fen;
    out.push({
      fen: applied.fen,
      ply: { fen: applied.fen, move, motions: applied },
    });
  }
  return out;
}

/** Whether an attempt is the line's move at `index`. A promotion must match
 * when the line names one; otherwise any promotion is wrong. */
export function isLineMove(
  line: readonly string[],
  index: number,
  attempt: MoveVariant,
): boolean {
  const want = line[index];
  if (!want) return false;
  const expected = moveFromUci(want);
  return (
    attempt.from === expected.from &&
    attempt.to === expected.to &&
    (attempt.promotion ?? undefined) === (expected.promotion ?? undefined)
  );
}

type IntroAction = {
  label: string;
  icon: ActionIconName;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export type IntroView = {
  board: BoardProps;
  title: string;
  body: string;
  tone: 'plain' | 'right' | 'wrong';
  actions: IntroAction[];
};

/** A board position at `id` with a move just played into it. */
function boardAt(
  id: string,
  fen: string,
  side: 'w' | 'b',
  ply: Ply | undefined,
  extra: Partial<BoardProps['presentation']> = {},
  movable = false,
  onAttempt: (a: MoveAttempt) => void = () => {},
): BoardProps {
  return {
    position: { id, fen },
    orientation: side,
    policy: movable
      ? {
          mode: 'movable',
          sides: [side],
          moves: legalMoves(fen),
          submissionEnabled: true,
        }
      : { mode: 'read-only' },
    presentation: {
      showDestinations: movable,
      highlights: [],
      arrows: [],
      ...(ply
        ? {
            lastMove: ply.move,
            transition: createTransition(
              { id: `${id}:in`, positionId: id, reason: 'opponent' },
              ply.motions,
            ),
          }
        : {}),
      ...extra,
    },
    onAttempt,
  };
}

/** The intro the deck asks for, step by step; undefined when there is none.
 * `onFinish` runs once, when it is finished or skipped. */
export function useLessonIntro(
  intro: LessonIntro | null | undefined,
  onFinish: (lesson: string) => void,
  reducedMotion: boolean,
): IntroView | undefined {
  const [step, setStep] = useState<Step>('explain');
  const [demoAt, setDemoAt] = useState(0);
  // The guided try: how far into its positions the board is, whether the
  // opponent's move has played in, the learner's last attempt and the hint.
  const [tryAt, setTryAt] = useState(0);
  const [wrong, setWrong] = useState<MoveAttempt>();
  const [hinted, setHinted] = useState(false);
  const key = intro?.lesson;

  // A new intro starts from the top (state reset while rendering, as React
  // recommends for state derived from a prop).
  const [owner, setOwner] = useState(key);
  if (owner !== key) {
    setOwner(key);
    setStep('explain');
    setDemoAt(0);
    setTryAt(0);
    setWrong(undefined);
    setHinted(false);
  }

  const demo = useMemo(
    () => (intro?.example ? linePositions(intro.example) : []),
    [intro?.example],
  );
  const guided = useMemo(
    () => (intro?.guided ? linePositions(intro.guided) : []),
    [intro?.guided],
  );

  const finish = useCallback(() => {
    if (key) onFinish(key);
  }, [key, onFinish]);

  // The demonstration plays itself.
  useEffect(() => {
    if (step !== 'demo' || demoAt >= demo.length - 1) return;
    const timer = setTimeout(
      () => setDemoAt((at) => at + 1),
      reducedMotion ? DEMO_STEP_REDUCED_MS : DEMO_STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [step, demoAt, demo.length, reducedMotion]);

  // The try: the opponent's move plays in, then replies follow the learner's.
  // Position 0 is the start; the learner moves from odd positions (1, 3, …)
  // and the opponent from even ones, so an even position plays itself on.
  useEffect(() => {
    if (step !== 'try' || !guided.length) return;
    if (tryAt % 2 === 1 || tryAt >= guided.length - 1) return;
    const timer = setTimeout(
      () => setTryAt((at) => at + 1),
      tryAt === 0 ? SETUP_MS : REPLY_MS,
    );
    return () => clearTimeout(timer);
  }, [step, tryAt, guided.length]);

  // Think first: the hint marks the piece only after a moment.
  const ready = step === 'try' && tryAt >= 1 && tryAt % 2 === 1;
  useEffect(() => {
    if (!ready || hinted) return;
    const timer = setTimeout(() => setHinted(true), THINK_MS);
    return () => clearTimeout(timer);
  }, [ready, hinted]);

  if (!intro) return undefined;
  const words = introCopy(intro.lesson, intro.name);
  // A lesson taught by explanation alone (a positional one, with no
  // positions yet): the knight says it over the starting position.
  if (!intro.example && !intro.guided)
    return {
      board: boardAt(
        `intro:${intro.lesson}:explain`,
        START_FEN,
        'w',
        undefined,
      ),
      title: intro.name,
      body: words.line,
      tone: 'plain',
      actions: [
        { label: 'Continue', icon: 'forward', primary: true, onPress: finish },
      ],
    };
  const skip: IntroAction = { label: 'Skip', icon: 'forward', onPress: finish };
  const example = intro.example ?? intro.guided;
  if (!example) return undefined;
  const side = example.color === 'white' ? 'w' : 'b';
  const toTry = () => {
    if (!intro.guided) return finish();
    setTryAt(0);
    setHinted(false);
    setWrong(undefined);
    setStep('try');
  };

  if (step === 'explain' || step === 'demo') {
    const showing = step === 'demo' ? demo : linePositions(example).slice(0, 1);
    const at = step === 'demo' ? Math.min(demoAt, showing.length - 1) : 0;
    const shown = showing[at] ?? { fen: example.fen_prev };
    const done = step === 'demo' && at >= showing.length - 1;
    return {
      board: boardAt(
        `intro:${intro.lesson}:demo:${at}`,
        shown.fen,
        side,
        shown.ply,
      ),
      title: step === 'explain' ? intro.name : 'Watch from the wall',
      body: words.line,
      tone: 'plain',
      actions:
        step === 'explain'
          ? [
              skip,
              {
                label: 'Watch from the wall',
                icon: 'forward',
                primary: true,
                onPress: () => {
                  if (!intro.example) return toTry();
                  setDemoAt(0);
                  setStep('demo');
                },
              },
            ]
          : [
              skip,
              {
                label: intro.guided ? 'Your turn' : 'Continue',
                icon: 'forward',
                primary: true,
                disabled: !done,
                onPress: toTry,
              },
            ],
    };
  }

  // The guided try, from the learner's side.
  const tried = intro.guided ?? example;
  const trySide = tried.color === 'white' ? 'w' : 'b';
  const at = Math.min(tryAt, guided.length - 1);
  const here = guided[at] ?? { fen: tried.fen_prev };
  const lineIndex = at - 1; // the learner's next move in `line`
  const expected = tried.line[lineIndex];
  const onAttempt = (attempt: MoveAttempt) => {
    if (!ready || step !== 'try') return;
    if (isLineMove(tried.line, lineIndex, attempt)) {
      const next = at + 1;
      setTryAt(next);
      if (next >= guided.length - 1) setStep('right');
    } else {
      setWrong(attempt);
      setStep('wrong');
    }
  };
  const answer = expected ? moveFromUci(expected) : undefined;
  const presentation: Partial<BoardProps['presentation']> =
    step === 'wrong' && wrong
      ? {
          highlights: [
            { square: wrong.from, tone: 'error', badge: false },
            { square: wrong.to, tone: 'error' },
          ],
          arrows: answer ? [{ ...answer, tone: 'best' }] : [],
        }
      : step === 'right' && here.ply
        ? {
            highlights: [
              { square: here.ply.move.from, tone: 'success' },
              { square: here.ply.move.to, tone: 'success' },
            ],
            correct: {
              square: here.ply.move.to,
              id: `intro:${intro.lesson}:right`,
            },
          }
        : ready && hinted && answer
          ? { hint: { square: answer.from } }
          : {};
  return {
    board: boardAt(
      `intro:${intro.lesson}:try:${at}`,
      here.fen,
      trySide,
      here.ply,
      presentation,
      ready,
      onAttempt,
    ),
    title:
      step === 'right'
        ? 'That’s the move'
        : step === 'wrong'
          ? 'Not this time'
          : 'Your turn on watch',
    body:
      step === 'right'
        ? 'Tonight’s positions follow.'
        : step === 'wrong'
          ? 'The arrow shows the move. Tonight’s positions follow.'
          : words.look,
    tone: step === 'right' ? 'right' : step === 'wrong' ? 'wrong' : 'plain',
    actions:
      step === 'right' || step === 'wrong'
        ? [
            {
              label: 'Continue',
              icon: 'forward',
              primary: true,
              onPress: finish,
            },
          ]
        : [
            skip,
            {
              label: 'Hint',
              icon: 'hint',
              disabled: !ready || hinted,
              onPress: () => setHinted(true),
            },
          ],
  };
}
