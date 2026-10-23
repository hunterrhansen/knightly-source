import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MoveGrade } from '../../chess/board';
import { GradeBadge } from '../../chess/board';
import type { LinePath } from '../../chess/line-tree';
import { moveTag, principleLabels } from '../../chess/mistake-layers';
import { invalidateAccount } from '../../lib/account-queries';
import type { GameDetail } from '../../lib/api/review-contract';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { answerHaptic } from '../../lib/haptics';
import {
  type ScopedSessions,
  useScopedSession,
} from '../../lib/use-scoped-session';
import { usePreferences } from '../../theme/preferences';
import { createStyles } from '../../theme/theme';
import {
  ActionBar,
  ActionButton,
  CoachBubble,
  FittedBoard,
  LessonFrame,
  LessonHeader,
  LessonTopBar,
  Notice,
  Page,
  praiseFor,
  Screen,
  useFoundationStyles,
  useLessonStyles,
  useMissCount,
  useSessionTime,
  useShortcut,
  useWideLesson,
  VerdictSheet,
} from '../../ui';
import {
  type PostMoment,
  type RankUp,
  SessionBeats,
  type StreakExtension,
  useDailyReview,
  useSessionEnd,
} from '../today/today-api';
import { EvalBar } from './eval-bar';
import { type LineEval, useLineEval } from './line-eval';
import {
  DeleteLine,
  type LineActions,
  LineStrip,
  MoveArrows,
  MoveStepper,
  MoveTable,
} from './move-list';
import {
  asideCoach,
  LineControls,
  lineCoach,
  moveLabel,
  orientationOf,
  phrase,
  playerBands,
  praised,
  useAside,
} from './review-aside';
import { reviewBoard, summaryBoard, withBestArrow } from './review-board';
import { useReviewKeys } from './review-keys';
import type { LoadLines } from './review-lines';
import { evalText, gradeOf, whiteWinPct } from './review-moments';
import { reviewResults } from './review-results';
import { ReviewSession, type ReviewState } from './review-session';
import { ReviewSummary, ReviewSummaryLoading } from './review-summary';
import { WinGraph } from './win-graph';

/** What the review changed beyond its marks (from Today's summary). */
export type ReviewEnd = {
  streak?: StreakExtension | null;
  mastered?: number;
  /** Null unless this review's answers carried the learner to a new rank. */
  rankUp?: RankUp | null;
  /** Posts the session cleared on the ward path. */
  posts?: PostMoment | null;
  pending?: boolean;
};

// Browsers without the Web Share API keep Best rather than a dead button.
const canShare =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

/** The system share sheet (the browser's on the web) for a move worth showing. */
async function shareMove(game: GameDetail, label = '', grade?: MoveGrade) {
  const opponent = game.color === 'black' ? game.white : game.black;
  const kind = grade === 'brilliant' ? 'A brilliant move' : 'A great move';
  try {
    await Share.share({
      message: [`${kind}: ${label}, against ${opponent}.`, game.url]
        .filter(Boolean)
        .join(' '),
    });
  } catch {
    // Dismissed or unsupported: nothing to do.
  }
}
/** The move list's side-line actions, with Delete from here confirmed in the
 * strip's place first. */
function useLineActions(session: ReviewSession, state: ReviewState) {
  const [deleting, setDeleting] = useState<LinePath>();
  const tree = state.tree;
  const actions: LineActions = {
    tree,
    path: state.line?.path,
    onOpen: (path) => {
      setDeleting(undefined);
      session.openPath(path);
    },
    onDelete: setDeleting,
  };
  const confirm =
    deleting && tree ? (
      <DeleteLine
        label={moveLabel(tree, deleting)}
        onCancel={() => setDeleting(undefined)}
        onDelete={() => {
          setDeleting(undefined);
          session.deleteLine(deleting);
        }}
      />
    ) : undefined;
  // The strip under the board: a side line's moves, or the game's.
  const strip = (
    current: number,
    onSelect: (index: number) => void,
    game: GameDetail,
  ) =>
    confirm ??
    (tree && state.line ? (
      <LineStrip
        tree={tree}
        path={state.line.path}
        start={state.line.start}
        actions={actions}
      />
    ) : (
      <MoveStepper
        game={game}
        current={current}
        onSelect={onSelect}
        lines={actions}
      />
    ));
  return { actions, confirm, strip };
}

/** The eval bar on a side line: the device engine's evaluation, level with
 * "…" while it starts, empty where there is no engine. */
const barFor = (ev: LineEval) =>
  ev.status === 'ready'
    ? { white: ev.white, evalText: ev.text }
    : { white: 50, evalText: ev.status === 'thinking' ? '…' : '' };
/** The coach's eval chip on a side line. */
const chipFor = (ev: LineEval) =>
  ev.status === 'ready' ? ev.text : ev.status === 'thinking' ? '…' : undefined;

function Lesson({
  session,
  state,
  game,
  onExit,
  load,
}: {
  session: ReviewSession;
  state: ReviewState;
  game: GameDetail;
  onExit: () => void;
  load: LoadLines;
}) {
  const styles = useLessonStyles();
  const aside = useAside(session, state, `${state.cursor}:${state.step}`, load);
  const lines = useLineActions(session, state);
  const engineEval = useLineEval(state.tree, state.line?.path);
  const bestArrow = usePreferences().preferences.bestMove === 'on';
  // The same answer haptics as practice: an error on each miss, success
  // when a find is answered clean.
  const misses = useMissCount(
    state.phase === 'wrong' || state.phase === 'refuting',
  );
  useEffect(() => {
    if (misses) answerHaptic(false);
  }, [misses]);
  const clean = state.marks.filter(
    (m) => m.mark === 'found' || m.mark === 'good',
  ).length;
  const cleanBefore = useRef(clean);
  useEffect(() => {
    if (clean > cleanBefore.current) answerHaptic(true);
    cleanBefore.current = clean;
  }, [clean]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Phones keep the board edge to edge: the eval moves into the coach's chip.
  const phone = screenWidth < 600;
  // Desktop and landscape tablets: the board beside a panel, as Chess.com's.
  const wide = useWideLesson();
  // During Next's quick run the bubble holds still and updates on landing.
  const steady = useRef<React.ComponentProps<typeof CoachBubble>>(undefined);
  const replay = state.replay;
  // ← → a move, ↑ ↓ the ends, Enter or Space what Next (or the verdict's
  // button) does, F flips, B and E open Best and Explain, H hints, S shows
  // and R retries a missed find, L opens All moves; inside a line ← → step
  // it and Esc or Backspace goes back to the game.
  const shownPly =
    session.atMoment() && state.steps[state.step]
      ? (state.steps[state.step]?.ply ?? state.cursor)
      : state.cursor;
  const lastPly = (replay?.positions.length ?? 1) - 1;
  const inLine = !!state.line || !!aside.request;
  const findStep =
    session.atMoment() && state.steps[state.step]?.type === 'find';
  const shownPlayed = shownPly > 0 ? game.plies[shownPly - 1] : undefined;
  const shownGrade = game.analysed ? gradeOf(shownPlayed) : undefined;
  const canExplain = game.analysed && shownPly > 0 && !findStep;
  const canBest =
    canExplain &&
    !!shownPlayed?.best_san &&
    !(shownGrade && praised.has(shownGrade));
  // The verdict's Why? opens the best line once a find is answered.
  const answeredFind =
    findStep && state.phase === 'answered' && !!state.exercise?.mark;
  const openBest =
    canBest || answeredFind
      ? () => aside.open({ kind: 'best', ply: shownPly })
      : undefined;
  useReviewKeys(
    inLine
      ? {
          previous: () => session.lineStep(-1),
          next: () => session.lineStep(1),
          flip: session.flip,
          advance: aside.close,
          back: aside.close,
        }
      : {
          previous: () => shownPly > 0 && session.goTo(shownPly - 1),
          next: () => shownPly < lastPly && session.goTo(shownPly + 1),
          first: () => session.goTo(0),
          last: () => session.goTo(lastPly),
          flip: session.flip,
          back: undefined,
          advance:
            state.phase === 'wrong'
              ? session.retry
              : state.phase === 'answered' || !findStep
                ? state.phase === 'saving' || state.phase === 'pending'
                  ? undefined
                  : session.next
                : undefined,
          best: openBest,
          explain: canExplain
            ? () => aside.open({ kind: 'why', ply: shownPly })
            : undefined,
          hint:
            findStep &&
            state.phase === 'ready' &&
            (state.exercise?.hintLevel ?? 0) < 2
              ? () => void session.hint()
              : undefined,
          reveal:
            findStep && state.phase === 'wrong'
              ? () => void session.reveal()
              : undefined,
          retry:
            findStep && state.phase === 'wrong' ? session.retry : undefined,
          list: state.phase === 'pending' ? undefined : session.replay,
        },
    !!replay,
  );
  if (!replay) return null;
  const step = state.steps[state.step];
  const atMoment = session.atMoment();
  const find = atMoment && step?.type === 'find';
  const shown = atMoment && step ? step.ply : state.cursor;
  // A find step shows the position before your move: its eval, not the reply's.
  const evalIndex = find ? shown - 1 : shown;
  const played = shown > 0 ? game.plies[shown - 1] : undefined;
  const grade = game.analysed ? gradeOf(played) : undefined;
  const evaluation = game.analysed ? evalText(game, evalIndex) : '';
  const e = state.exercise;
  const last = replay.positions.length - 1;
  const finishing =
    state.step === state.steps.length &&
    !state.moments.some((p) => p > state.cursor) &&
    state.cursor === last;

  const coach = aside.request
    ? asideCoach(aside)
    : state.line
      ? lineCoach(state)
      : find
        ? {
            title: 'Find a better move',
            grade,
            // What went wrong would hint at the answer, so it waits for one.
            tag: played && moveTag(played, state.phase !== 'answered'),
            body:
              // The verdict sheet stays compact; its explanation lives here.
              (e?.hint && state.phase === 'ready') ||
              state.phase === 'wrong' ||
              state.phase === 'answered'
                ? state.message.replace(/^Not quite\.\s*/, '')
                : `You played ${replay.labels[shown]} here.${state.phase === 'ready' ? ' A hint marks it “with help”.' : ''}`,
          }
        : atMoment && step
          ? {
              // A look step is a move to see, not solve.
              title:
                step.title === 'Find a better move' && grade
                  ? `${played?.san ?? ''} is ${phrase[grade]}`
                  : step.title,
              grade,
              tag: played && moveTag(played),
              evalText: evaluation,
              // Why you missed it, when a cause holds; it names their reply.
              body:
                played?.cause?.cause_text ??
                (step.type === 'look' && played?.best_san
                  ? `Best was ${played.best_san}.`
                  : undefined),
            }
          : shown === 0
            ? {
                title: 'Starting position',
                body: 'Next jumps to the next key moment; ‹ › step one move.',
              }
            : {
                title: grade
                  ? `${played?.san ?? ''} is ${phrase[grade]}`
                  : (replay.labels[shown] ?? ''),
                grade,
                tag: played && moveTag(played),
                evalText: evaluation,
                body:
                  played?.cause?.cause_text ??
                  (grade && !praised.has(grade) && played?.best_san
                    ? `Best was ${played.best_san}.`
                    : undefined),
              };

  if (state.playingTo === undefined || !steady.current)
    steady.current =
      state.line && !aside.request
        ? { ...coach, evalText: chipFor(engineEval) }
        : (phone || wide) && game.analysed && !inLine
          ? { ...coach, evalText: evaluation }
          : coach;
  const shownCoach = steady.current;
  const gameBoard = reviewBoard(state, session, session.play);
  const board = state.line
    ? bestArrow && engineEval.status === 'ready'
      ? withBestArrow(gameBoard, engineEval.best)
      : gameBoard
    : bestArrow &&
        canBest &&
        gameBoard?.position.fen === replay.positions[shown]
      ? withBestArrow(gameBoard, played?.best_uci)
      : gameBoard;
  // As on Chess.com, your brilliant and great moves offer Share in place of Best.
  const shareable =
    canShare &&
    canExplain &&
    played?.color === game.color &&
    (grade === 'brilliant' || grade === 'great');

  // A verdict slides over the bottom bar, so the board never resizes for it.
  const sheet = (filled: boolean) =>
    !aside.request && find && state.phase === 'answered' && e?.mark ? (
      <VerdictSheet
        fill={filled}
        tone="right"
        points={
          state.award?.id.startsWith(`${e.id}:`) ? state.award : undefined
        }
        title={
          e.mark === 'found'
            ? praiseFor(e.id)
            : e.mark === 'good'
              ? 'Good move'
              : e.mark === 'helped'
                ? 'Solved with help'
                : `Best was ${played?.best_san ?? 'shown'}`
        }
        secondary={{
          label: 'Why?',
          shortcut: 'B',
          onPress: () => aside.open({ kind: 'best', ply: shown }),
        }}
        primary={{
          label: 'Continue',
          advances: true,
          shortcut: 'Enter',
          onPress: session.next,
        }}
      />
    ) : !aside.request && find && state.phase === 'wrong' ? (
      <VerdictSheet
        fill={filled}
        tone="wrong"
        title="Not quite"
        evalText={e?.principle ? principleLabels[e.principle] : undefined}
        secondary={{
          label: 'Show me',
          shortcut: 'S',
          onPress: () => void session.reveal(),
        }}
        primary={{ label: 'Try again', shortcut: 'R', onPress: session.retry }}
      />
    ) : undefined;
  let bottom: React.ReactNode;
  if (inLine)
    bottom = <LineControls session={session} state={state} aside={aside} />;
  else if (state.phase === 'uncertain')
    bottom = (
      <ActionBar>
        <ActionButton
          icon="retry"
          label="Check saved progress"
          primary
          onPress={() => void session.checkAnswer()}
        />
      </ActionBar>
    );
  else if (state.phase === 'save-uncertain')
    bottom = (
      <ActionBar>
        <ActionButton
          icon="retry"
          label="Check saved review"
          primary
          onPress={() => void session.checkFinish()}
        />
      </ActionBar>
    );
  else if (find)
    bottom = (
      <ActionBar>
        <ActionButton
          icon="hint"
          label={e?.hintLevel ? 'Show move' : 'Hint'}
          shortcut="H"
          disabled={state.phase !== 'ready' || (e?.hintLevel ?? 0) >= 2}
          onPress={() => void session.hint()}
        />
      </ActionBar>
    );
  else
    bottom = (
      <ActionBar>
        <ActionButton
          icon="hint"
          label="Explain"
          shortcut="E"
          disabled={!canExplain}
          onPress={() => aside.open({ kind: 'why', ply: shown })}
        />
        <ActionButton
          {...(shareable
            ? {
                icon: 'share' as const,
                label: 'Share',
                onPress: () =>
                  void shareMove(game, replay.labels[shown], grade),
              }
            : {
                icon: 'best' as const,
                label: 'Best',
                shortcut: 'B',
                disabled: !canBest,
                onPress: () => aside.open({ kind: 'best', ply: shown }),
              })}
        />
        <ActionButton
          icon="forward"
          label={
            state.phase === 'saving' ? 'Saving…' : finishing ? 'Finish' : 'Next'
          }
          primary
          shortcut="Enter"
          disabled={state.phase === 'saving' || state.phase === 'pending'}
          onPress={session.next}
        />
      </ActionBar>
    );

  const orientation = board?.orientation ?? orientationOf(game, state.flipped);
  return (
    // One row, as on Duolingo: the bar carries ✕ and the list.
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <LessonFrame
        bars={
          <>
            <LessonHeader title="Game review" hidden />
            <LessonTopBar
              done={state.marks.length}
              current={state.step}
              total={state.steps.length}
              combo={state.combo}
              misses={misses}
              points={state.points ?? 0}
              award={state.award}
              onExit={onExit}
              exitLabel="Exit review, progress is saved"
              onList={state.phase === 'pending' ? undefined : session.replay}
              listShortcut="L"
            />
          </>
        }
        coach={
          <>
            {game.analysed && !phone && !wide && (
              <EvalBar
                {...(inLine
                  ? barFor(engineEval)
                  : {
                      white: whiteWinPct(game, evalIndex),
                      evalText: evaluation,
                    })}
              />
            )}
            <CoachBubble
              {...shownCoach}
              lines={2}
              tone={
                inLine
                  ? 'plain'
                  : find && state.phase === 'wrong'
                    ? 'wrong'
                    : find && state.phase === 'answered'
                      ? 'right'
                      : 'plain'
              }
            />
          </>
        }
        board={board}
        orientation={orientation}
        award={state.award}
        bands={playerBands(
          game,
          replay.positions,
          state.line ? state.cursor : evalIndex,
          orientation,
          board?.position.fen,
        )}
        reserve={48}
        below={lines.strip(shown, session.goTo, game)}
        sheet={sheet}
        actions={bottom}
        compact={phone}
        side={
          wide
            ? {
                beside: game.analysed ? (
                  <EvalBar
                    orientation="vertical"
                    whiteOnTop={orientation === 'b'}
                    {...(inLine
                      ? barFor(engineEval)
                      : {
                          white: whiteWinPct(game, evalIndex),
                          evalText: evaluation,
                        })}
                  />
                ) : undefined,
                panel: (
                  <>
                    {lines.confirm}
                    <MovesPanel
                      game={game}
                      current={shown}
                      onSelect={session.goTo}
                      lines={lines.actions}
                      arrows={!inLine}
                    />
                  </>
                ),
              }
            : undefined
        }
      />
    </View>
  );
}

/** The review's screens for one session: summary, lesson, All moves and the
 * end; the preview runs it with sample data and no backend. */
function AllMoves({
  session,
  state,
  game,
  onExit,
  load,
}: {
  session: ReviewSession;
  state: ReviewState;
  game: GameDetail;
  onExit: () => void;
  load: LoadLines;
}) {
  const styles = useStyles();
  const lesson = useLessonStyles();
  const aside = useAside(session, state, String(state.replayIndex), load);
  const lines = useLineActions(session, state);
  const engineEval = useLineEval(state.tree, state.line?.path);
  const bestArrow = usePreferences().preferences.bestMove === 'on';
  const insets = useSafeAreaInsets();
  const wide = useWideLesson();
  const replay = state.replay;
  const at = state.replayIndex;
  const end = (replay?.positions.length ?? 1) - 1;
  const lineOpen = !!state.line || !!aside.request;
  const played = at > 0 ? game.plies[at - 1] : undefined;
  const grade = game.analysed ? gradeOf(played) : undefined;
  const hidden = session.answerHidden(at);
  const showBest =
    game.analysed &&
    !state.blocked &&
    !hidden &&
    !!played?.best_san &&
    !(grade && praised.has(grade));
  useReviewKeys(
    lineOpen
      ? {
          previous: () => session.lineStep(-1),
          next: () => session.lineStep(1),
          flip: session.flip,
          back: aside.close,
        }
      : {
          previous: () => at > 0 && session.select(at - 1),
          next: () => at < end && session.select(at + 1),
          first: () => session.select(0),
          last: () => session.select(end),
          flip: session.flip,
          back: state.blocked ? undefined : session.lesson,
          best: showBest
            ? () => aside.open({ kind: 'best', ply: at })
            : undefined,
          list: state.blocked ? undefined : session.lesson,
        },
    !!replay,
  );
  if (!replay) return null;
  const index = state.replayIndex;
  const last = replay.positions.length - 1;
  const shownBoard = reviewBoard(state, session, session.play);
  const board = state.line
    ? bestArrow && engineEval.status === 'ready'
      ? withBestArrow(shownBoard, engineEval.best)
      : shownBoard
    : bestArrow && showBest
      ? withBestArrow(shownBoard, played?.best_uci)
      : shownBoard;
  const orientation = board?.orientation ?? orientationOf(game, state.flipped);
  const bands = playerBands(
    game,
    replay.positions,
    index,
    orientation,
    board?.position.fen,
  );
  const evalBar =
    game.analysed && !state.blocked ? (
      <EvalBar
        orientation="vertical"
        whiteOnTop={orientationOf(game, state.flipped) === 'b'}
        {...(lineOpen
          ? barFor(engineEval)
          : {
              white: whiteWinPct(game, index),
              evalText: evalText(game, index),
            })}
      />
    ) : undefined;
  const coach = aside.request ? (
    <CoachBubble {...asideCoach(aside)} lines={2} />
  ) : (
    state.blocked && <Notice title={state.blocked} />
  );
  // A line you played keeps the card's place, so the board stays put.
  const lineCard = state.line && !aside.request && (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {lineCoach(state).title}
        </Text>
        <Text style={styles.cardEval}>{chipFor(engineEval)}</Text>
      </View>
      <ActionButtonLink
        label={lineCoach(state).body ?? ''}
        onPress={aside.close}
      />
    </View>
  );
  const card =
    lineCard ||
    (!lineOpen && game.analysed && !state.blocked && index > 0 && (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {grade && <GradeBadge grade={grade} size={22} />}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {grade
              ? `${replay.labels[index]} is ${phrase[grade]}`
              : replay.labels[index]}
          </Text>
          <Text style={styles.cardEval}>{evalText(game, index)}</Text>
        </View>
        {hidden ? (
          <ActionButtonLink
            label="Answer hidden while you solve · Reveal (counts as help)"
            onPress={session.revealAnswer}
          />
        ) : (
          showBest && (
            <ActionButtonLink
              label={`Best was ${played.best_san} · See best line`}
              shortcut="B"
              onPress={() => aside.open({ kind: 'best', ply: index })}
            />
          )
        )}
      </View>
    ));
  const controls = lineOpen ? (
    <LineControls session={session} state={state} aside={aside} />
  ) : (
    <ActionBar>
      <ActionButton
        icon="first"
        label="First"
        shortcut="ArrowUp Home"
        disabled={index === 0}
        onPress={() => session.select(0)}
      />
      <ActionButton
        icon="previous"
        label="Back"
        accessibilityLabel="Previous move"
        shortcut="ArrowLeft"
        disabled={index === 0}
        onPress={() => session.select(index - 1)}
      />
      <ActionButton
        icon="next"
        label="Forward"
        accessibilityLabel="Next move"
        shortcut="ArrowRight"
        primary
        disabled={index === last}
        onPress={() => session.select(index + 1)}
      />
      <ActionButton
        icon="last"
        label="Last"
        shortcut="ArrowDown End"
        disabled={index === last}
        onPress={() => session.select(last)}
      />
      <ActionButton
        icon="flip"
        label="Flip"
        shortcut="F"
        onPress={session.flip}
      />
    </ActionBar>
  );
  const header = (
    <LessonHeader
      title={state.blocked ? 'Game review' : 'All moves'}
      {...(state.blocked ? { onClose: onExit } : { onBack: session.lesson })}
    />
  );
  if (wide)
    return (
      <LessonFrame
        bars={header}
        coach={
          <>
            {coach}
            {card}
          </>
        }
        board={board}
        orientation={orientation}
        bands={bands}
        reserve={0}
        actions={controls}
        side={{
          beside: evalBar,
          panel: (
            <>
              {lines.confirm}
              <MoveTable
                game={game}
                current={index}
                onSelect={session.select}
                lines={lines.actions}
              />
              {game.analysed && !state.blocked && (
                <WinGraph
                  game={game}
                  height={64}
                  cursor={index}
                  onSelect={session.select}
                />
              )}
            </>
          ),
        }}
      />
    );
  return (
    <View style={lesson.fill}>
      {header}
      {/* Never scrolls: the board takes the room left above the strip. */}
      <View style={[lesson.content, lesson.body]}>
        {coach}
        <FittedBoard board={board} {...bands} beside={evalBar} />
        {game.analysed && !state.blocked && !aside.request && (
          <WinGraph
            game={game}
            height={44}
            cursor={index}
            onSelect={session.select}
          />
        )}
        {card}
        {lines.strip(index, session.select, game)}
      </View>
      <View style={[lesson.pinned, { paddingBottom: insets.bottom + 8 }]}>
        {controls}
      </View>
    </View>
  );
}

/** The wide layout's panel under the coach: every move, the win graph and
 * ‹ › to step one move. */
function MovesPanel({
  game,
  current,
  onSelect,
  lines,
  graph = true,
  arrows = true,
}: {
  game: GameDetail;
  current: number;
  onSelect: (index: number) => void;
  lines?: LineActions;
  graph?: boolean;
  /** The game's ‹ ›, hidden while the bar steps a side line. */
  arrows?: boolean;
}) {
  return (
    <>
      <MoveTable
        game={game}
        current={current}
        onSelect={onSelect}
        lines={lines}
      />
      {graph && game.analysed && (
        <WinGraph
          game={game}
          height={64}
          cursor={current}
          onSelect={onSelect}
        />
      )}
      {arrows && (
        <MoveArrows game={game} current={current} onSelect={onSelect} />
      )}
    </>
  );
}

function ActionButtonLink({
  label,
  onPress,
  shortcut,
}: {
  label: string;
  onPress: () => void;
  shortcut?: string;
}) {
  const foundationStyles = useFoundationStyles();
  const styles = useStyles();
  const keys = useShortcut('See best line', shortcut);
  return (
    <Text
      ref={keys.ref as never}
      {...keys.props}
      accessibilityRole="button"
      onPress={onPress}
      style={[foundationStyles.link, styles.textButton]}
    >
      {label}
    </Text>
  );
}

export function ReviewLayout({
  session,
  state,
  onExit,
  loadLines,
  end,
  onKeepWatch,
}: {
  session: ReviewSession;
  state: ReviewState;
  onExit: () => void;
  /** Opens tonight's watch from the game's screen, while it isn't kept. */
  onKeepWatch?: () => void;
  loadLines: LoadLines;
  /** What the review changed beyond its marks (from Today's summary). */
  end?: ReviewEnd;
}) {
  const styles = useLessonStyles();
  const game = state.game;
  const wide = useWideLesson();
  // On the summary Enter or Space starts the review, F flips the board.
  useReviewKeys(
    { advance: session.begin, flip: session.flip },
    !!game && state.stage === 'summary' && state.view !== 'replay',
  );
  // This visit's review time, from the first lesson step to completion.
  const elapsed = useSessionTime(
    state.stage === 'review',
    state.phase === 'complete' && state.stage === 'review',
  );
  let body: React.ReactNode;
  if (state.phase === 'error' && !game)
    body = (
      <View style={styles.content}>
        <LessonHeader title="Game review" onClose={onExit} />
        <Notice
          title="Could not load game"
          message={state.message}
          action="Retry game"
          onAction={() => void session.load()}
        />
      </View>
    );
  else if (!game) body = <ReviewSummaryLoading onExit={onExit} />;
  else if (state.view === 'replay' || state.blocked)
    body = (
      <AllMoves
        session={session}
        state={state}
        game={game}
        onExit={onExit}
        load={loadLines}
      />
    );
  else if (state.stage === 'summary') {
    const board = wide ? summaryBoard(state) : undefined;
    body = (
      <ReviewSummary
        side={
          board && state.replay
            ? {
                board,
                bands: playerBands(
                  game,
                  state.replay.positions,
                  0,
                  board.orientation,
                ),
                beside: game.analysed ? (
                  <EvalBar
                    orientation="vertical"
                    whiteOnTop={board.orientation === 'b'}
                    white={whiteWinPct(game, 0)}
                    evalText={evalText(game, 0)}
                  />
                ) : undefined,
              }
            : undefined
        }
        game={game}
        moments={state.moments.length}
        reviewed={!!game.reviewed_at}
        onExit={onExit}
        onStart={session.begin}
        onMoves={(index = 0) => session.browseAt(index)}
        onKeepWatch={onKeepWatch}
      />
    );
  } else if (state.phase === 'complete')
    return (
      <SessionBeats
        key={game.reviewed_at ?? 'complete'}
        results={{
          ...reviewResults(
            {
              marks: state.marks,
              steps: state.steps,
              labels: state.replay?.labels,
            },
            game,
            elapsed,
            session.pointsSummary(),
          ),
          secondary: state.blocked
            ? undefined
            : { label: 'Review again', onPress: session.begin },
        }}
        streak={end?.streak}
        mastered={end?.mastered}
        rankUp={end?.rankUp}
        posts={end?.posts}
        pending={end?.pending}
        finish={{ label: 'Done', onPress: onExit }}
      />
    );
  else
    body = (
      <Lesson
        session={session}
        state={state}
        game={game}
        onExit={onExit}
        load={loadLines}
      />
    );
  return (
    // The bottom inset is each view's own, so sheets can run to the edge.
    <Screen preset="fixed" safeAreaEdges={Platform.OS === 'web' ? ['top'] : []}>
      {body}
    </Screen>
  );
}

// One session per account scope and game: returning to a game keeps its attempt.
const sessions: ScopedSessions<number, ReviewSession> = new WeakMap();

/** Whether tonight's watch is still to keep: a lesson with moves left and
 * no night kept yet today. Unknown counts as kept, so the button never
 * flashes up and away. */
function useWatchOpen(enabled: boolean) {
  const today = useDailyReview({ enabled }).data;
  return (
    enabled &&
    !!today &&
    !today.streak.safe_today &&
    today.lesson.done < today.lesson.total
  );
}

function GameReview({
  gameId,
  onExit,
  onKeepWatch,
}: {
  gameId: number;
  onExit: () => void;
  onKeepWatch?: () => void;
}) {
  const watchOpen = useWatchOpen(!!onKeepWatch);
  const { session, state } = useScopedSession(
    sessions,
    gameId,
    (scope) =>
      new ReviewSession(scope.api, gameId, scope.isCurrent, () => {
        if (scope.isCurrent()) void invalidateAccount(scope, 'review');
      }),
  );
  const end = useSessionEnd(
    state.phase === 'complete' && state.stage === 'review',
  );
  const { scope } = useSessionScope();
  // Every move's lines arrive once, in the background, as the review opens;
  // Best and Why then show them at once. A move without stored lines (a game
  // analysed before they were kept) is still fetched on its own, as is every
  // line when this read fails.
  const stored = useQuery({
    queryKey: [...scope.meKey, 'game-lines', gameId],
    queryFn: ({ signal }) => scope.api.gameLines(gameId, signal),
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
  const loadLines = useMemo<LoadLines>(
    () =>
      Object.assign(
        (ply: number, signal: AbortSignal) =>
          scope.api.engineLines(gameId, ply, signal),
        {
          key: [...scope.meKey, 'engine-lines', gameId],
          peek: (ply: number) => stored?.get(ply),
        },
      ),
    [scope, gameId, stored],
  );
  return (
    <ReviewLayout
      session={session}
      state={state}
      onExit={onExit}
      loadLines={loadLines}
      end={end}
      onKeepWatch={watchOpen ? onKeepWatch : undefined}
    />
  );
}

export function ReviewScreen({
  gameId,
  onExit,
  onKeepWatch,
}: {
  gameId: string | string[] | undefined;
  onExit: () => void;
  /** Opens tonight's watch; the game's screen offers it while it isn't kept. */
  onKeepWatch?: () => void;
}) {
  const foundationStyles = useFoundationStyles();
  const value =
    typeof gameId === 'string' && /^[1-9]\d*$/.test(gameId)
      ? Number(gameId)
      : NaN;
  if (!Number.isSafeInteger(value))
    return (
      <Page title="Game review">
        <Notice title="Invalid game link" />
        <Link href="/games" asChild>
          <Text style={foundationStyles.link}>Back to Games</Text>
        </Link>
      </Page>
    );
  return (
    <GameReview
      key={value}
      gameId={value}
      onExit={onExit}
      onKeepWatch={onKeepWatch}
    />
  );
}

const useStyles = createStyles((theme) => ({
  textButton: {
    minWidth: 72,
    minHeight: 44,
    textAlignVertical: 'center',
    paddingVertical: theme.spacing.sm,
  },
  card: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.control,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body + 2,
  },
  cardEval: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    fontVariant: ['tabular-nums'],
  },
}));
