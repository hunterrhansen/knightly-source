import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet as NativeStyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { BoardProps } from '../../chess/board';
import { principleLabels } from '../../chess/mistake-layers';
import { tacticNames } from '../../chess/tactics';
import { invalidateAccount } from '../../lib/account-queries';
import { deckGrowth } from '../../lib/deck-growth';
import { answerHaptic } from '../../lib/haptics';
import {
  type ScopedSessions,
  useScopedSession,
} from '../../lib/use-scoped-session';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { useTextBlock } from '../../theme/use-text-block';
import {
  ActionBar,
  ActionButton,
  ActionIcon,
  Avatar,
  Button,
  CoachBubble,
  emptyBoard,
  LessonFrame,
  LessonHeader,
  LessonTopBar,
  praiseFor,
  type Raid,
  Screen,
  SkeletonLine,
  useLoadingCoach,
  useMissCount,
  usePressSquish,
  useSessionTime,
  useWallView,
  VerdictSheet,
} from '../../ui';
import {
  type PostMoment,
  type RankUp,
  SessionBeats,
  type StreakExtension,
  taughtAt,
  useSessionEnd,
} from '../today/today-api';
import { type Badge, badgeAbout } from './badge-copy';
import { HideCard } from './hide-card';
import { useLessonIntro } from './lesson-intro';
import { LineSteps } from './line-steps';
import { heldBoard, practiceBoard } from './practice-board';
import { practiceProgress } from './practice-progress';
import { raidOf } from './practice-raid';
import { practiceResults, raidsTurnedBack } from './practice-results';
import {
  cardPrompt,
  NO_THREAT,
  PracticeSession,
  questionKind,
  yourMoveVerdict,
} from './practice-session';
import { QUESTION_COPY } from './threat-copy';
import { TopMoves, topMovesTitle } from './top-moves';
import { useStepKeys } from './use-step-keys';

type PracticeState = ReturnType<PracticeSession['getSnapshot']>;
type Deck = NonNullable<PracticeState['deck']>;
/** What the session changed beyond its own results (from Today's summary). */
export type PracticeEnd = {
  streak?: StreakExtension | null;
  mastered?: number;
  rankUp?: RankUp | null;
  /** Posts the session cleared on the ward path. */
  posts?: PostMoment | null;
  pending?: boolean;
  /** Positions due tomorrow, for Results' last line. */
  tomorrowDue?: number;
};

const passed = (quality: string | undefined) =>
  quality === 'best' || quality === 'excellent' || quality === 'good';

// One session per account scope and mode: tonight's watch and an extra watch
// each keep their own position.
const sessions: ScopedSessions<string, PracticeSession> = new WeakMap();

export function PracticeScreen({
  extra = false,
}: {
  /** An extra watch after tonight's is kept: the same lesson from the wall,
   * never the streak's beats. Otherwise tonight's watch (the daily lesson). */
  extra?: boolean;
}) {
  const mode = extra ? 'extra' : 'lesson';
  const { session, state } = useScopedSession(
    sessions,
    mode,
    (scope) =>
      new PracticeSession(
        scope.api,
        scope.isCurrent,
        undefined,
        undefined,
        () => {
          if (scope.isCurrent()) void invalidateAccount(scope, 'answer');
        },
        undefined,
        mode,
      ),
  );
  const end = useSessionEnd(state.phase === 'complete');
  return (
    <PracticeLayout
      session={session}
      state={state}
      onExit={() => router.replace('/')}
      lesson={!extra}
      extra={extra}
      end={end}
      canHide
      // Tonight's watch, and an extra watch another: seen from the castle wall.
      watch
    />
  );
}

/** Chess.com-style puzzle screen in Game review's lesson layout: segmented
 * progress, the coach's bubble, a board fitted to the room left and the bottom
 * action bar, with a verdict sheet after a miss. */
export function PracticeLayout({
  session,
  state,
  onExit,
  lesson = false,
  extra = false,
  end,
  canHide = false,
  watch = false,
}: {
  session: PracticeSession;
  state: PracticeState;
  onExit: () => void;
  lesson?: boolean;
  /** An extra watch: its own progress and results; it never keeps the night,
   * so its end has no streak beat. */
  extra?: boolean;
  end?: PracticeEnd;
  /** "Don't show this again" in a card's verdict: it saves to the account,
   * so only the signed-in screen offers it (not the Storybook preview). */
  canHide?: boolean;
  /** The lesson seen from the castle wall (the watch's frame). */
  watch?: boolean;
}) {
  const styles = useStyles();
  const wallView = useWallView('scene.wallView');
  const { theme } = useTheme();
  const text = useTextBlock();
  // Room under the board for the meta line and the solution's ‹ › steps.
  const belowHeight = text.height(14, 1) + 44 + 16 + 8;
  // The lesson label's row above the coach, kept whether or not it shows.
  const labelHeight = Math.max(24, text.height(theme.typography.size.small, 1));
  const board = practiceBoard(state, session);
  // A lesson to introduce before tonight's item (the Steps Method's explain,
  // demonstrate, try one): shown in this same frame, so the board never moves.
  const reduced = useSystemReducedMotion();
  const [introduced, setIntroduced] = useState<ReadonlySet<string>>(new Set());
  const onIntroDone = useCallback(
    (key: string) => {
      session.introduced(key);
      setIntroduced((seen) => new Set(seen).add(key));
    },
    [session],
  );
  const pendingIntro =
    state.phase !== 'complete' &&
    state.deck?.intro &&
    !introduced.has(state.deck.intro.lesson)
      ? state.deck.intro
      : undefined;
  const intro = useLessonIntro(pendingIntro, onIntroDone, reduced);
  // While the next position loads, keep the last board in place (read-only)
  // rather than collapsing the layout.
  const lastBoard = useRef<BoardProps | undefined>(undefined);
  if (board) lastBoard.current = board;
  // The first load shows the real frame with an empty board; the pieces drop
  // in when the position lands.
  const firstLoad = state.phase === 'loading' && !lastBoard.current;
  const loadingCoach = useLoadingCoach('practice');
  const shownBoard =
    board ??
    (state.phase === 'loading'
      ? lastBoard.current
        ? heldBoard(lastBoard.current)
        : emptyBoard()
      : undefined);
  const e = state.exercise;
  const item = e?.item;
  const card = item?.kind === 'card' ? item : undefined;
  const puzzle = item?.kind === 'puzzle' ? item : undefined;
  const { phase } = state;
  // Likewise its label, meta line, progress and action bar, so nothing on
  // screen shifts until the next position arrives.
  const lastExercise = useRef<typeof e>(undefined);
  if (e) lastExercise.current = e;
  const held = !e && shownBoard ? lastExercise.current : undefined;
  const shown = e ?? held;
  const shownItem = shown?.item;
  // From the wall, the position's opponent pieces wait at the treeline; the
  // last raid stays while the next position loads.
  const lastRaid = useRef<Raid | undefined>(undefined);
  const raid =
    watch && e
      ? raidOf(e, phase, shownBoard?.orientation ?? 'w')
      : watch && held
        ? lastRaid.current
        : undefined;
  lastRaid.current = raid;
  const shownCard = shownItem?.kind === 'card' ? shownItem : undefined;
  // This visit's session time, from the first exercise shown to completion.
  const elapsed = useSessionTime(!!e, phase === 'complete');
  // Why? swaps the line's steps for the top moves, for this position only.
  const [whyFor, setWhyFor] = useState<string>();
  const topMoves =
    phase === 'answered' && e?.candidates?.length ? e.candidates : undefined;
  const showWhy = topMoves !== undefined && whyFor === e?.positionId;
  const solved = phase === 'answered' && passed(e?.quality);
  const line = phase === 'answered' ? e?.line : undefined;
  useStepKeys(Boolean(line), session.step);

  // Success and error haptics, once per answer.
  const attemptId = e?.attempt?.attemptId;
  const threatAnswer = e?.threat?.answer;
  const threatRight = e?.threat?.correct;
  useEffect(() => {
    if (threatAnswer !== undefined) answerHaptic(Boolean(threatRight));
  }, [threatAnswer, threatRight]);
  useEffect(() => {
    if (phase === 'answered' && attemptId && e?.quality !== 'shown')
      answerHaptic(passed(e?.quality));
    else if (phase === 'wrong' && attemptId) answerHaptic(false);
  }, [phase, attemptId, e?.quality]);

  const toMove = item?.color === 'white' ? 'White' : 'Black';
  const asking = phase === 'threat';
  const threatShown = phase === 'threat-shown';
  const question = QUESTION_COPY[item ? questionKind(item) : 'threat'];
  const title = asking
    ? question.title
    : threatShown
      ? e?.threat?.threats.length
        ? question.answer
        : 'No threat here'
      : phase === 'wrong'
        ? `${toMove} to move`
        : solved
          ? 'Solved'
          : phase === 'answered' || phase === 'revealing'
            ? 'Solution'
            : phase === 'replying'
              ? 'Correct'
              : e
                ? `${toMove} to move`
                : phase === 'complete'
                  ? state.message
                  : phase === 'error'
                    ? 'Reload to continue'
                    : 'Practice';
  const body = asking
    ? question.prompt(item?.kind === 'question' ? item.played_san : '')
    : threatShown
      ? state.message
      : phase === 'ready' && e && !e.hint && !e.acknowledged
        ? e.played.length
          ? 'Keep going. Find the next move.'
          : card
            ? cardPrompt(card)
            : puzzle?.mode === 'taught' && taughtAt(state.deck?.ward)
              ? `${taughtAt(state.deck?.ward)?.lesson}: find it for ${toMove.toLowerCase()}.`
              : `Find the best move for ${toMove.toLowerCase()}.`
        : solved
          ? [e?.why, state.message.replace(/^Found it[.!] ?/, '')]
              .filter(Boolean)
              .join(' ')
          : phase === 'complete'
            ? state.deck?.today.done || state.deck?.puzzles?.done
              ? 'Nice work. Your next reviews are scheduled.'
              : ''
            : phase === 'answered' && e?.why
              ? `${state.message} ${e.why}`
              : state.message;
  const tactic = card?.pattern ?? puzzle?.themes.find((t) => tacticNames[t]);
  const theme_ =
    tactic && phase === 'answered' ? tacticNames[tactic] : undefined;

  // An answer's verdict slides over the bottom bar, as in Game review.
  const sheet = (filled: boolean) =>
    threatShown && e?.threat ? (
      <VerdictSheet
        fill={filled}
        tone={e.threat.correct ? 'right' : 'wrong'}
        title={e.threat.correct ? 'Spotted it' : 'Missed it'}
        primary={
          item?.kind === 'card'
            ? { label: 'Find your move', onPress: session.findMove }
            : { label: 'Continue', onPress: () => void session.next() }
        }
      />
    ) : phase === 'answered' && e ? (
      <VerdictSheet
        fill={filled}
        tone="right"
        evalText={theme_}
        points={
          state.award?.id.startsWith(`${e.positionId}:`)
            ? state.award
            : undefined
        }
        body={
          card?.unannounced && e.quality !== 'shown'
            ? yourMoveVerdict(card.unannounced, true).body
            : e.nextReview
        }
        badge={e.quality !== 'shown'}
        title={
          showWhy && topMoves
            ? topMovesTitle(topMoves)
            : e.quality === 'shown'
              ? 'Here’s the line'
              : card?.unannounced
                ? yourMoveVerdict(card.unannounced, true).title
                : e.hinted
                  ? 'Solved with help'
                  : state.combo
                    ? praiseFor(attemptId ?? e.positionId)
                    : 'Found it'
        }
        {...(topMoves
          ? {
              secondary: {
                label: showWhy ? 'Line' : 'Why?',
                onPress: () => {
                  // Back to the line puts the solution back on the board.
                  if (showWhy) session.playCandidate(undefined);
                  setWhyFor(showWhy ? undefined : e.positionId);
                },
              },
            }
          : {})}
        primary={{
          label: 'Continue',
          advances: true,
          onPress: () => void session.next(),
        }}
      >
        {showWhy && topMoves ? (
          <TopMoves
            candidates={topMoves}
            playing={e.candidate?.uci}
            onPlay={session.playCandidate}
          />
        ) : (
          line && (
            <LineSteps
              view={e.view ?? line.uci.length}
              san={line.san}
              onStep={session.step}
            />
          )
        )}
        {canHide && card && !card.unannounced && !showWhy && (
          <HideCard gameId={card.game_id} ply={card.ply} />
        )}
      </VerdictSheet>
    ) : phase === 'wrong' ? (
      <VerdictSheet
        fill={filled}
        tone="wrong"
        title="Not quite"
        body={
          card?.unannounced
            ? yourMoveVerdict(card.unannounced, false).body
            : e?.nextReview
        }
        evalText={e?.principle ? principleLabels[e.principle] : undefined}
        secondary={{ label: 'Solution', onPress: () => void session.reveal() }}
        primary={{ label: 'Try again', onPress: session.retry }}
      >
        {canHide && card && !card.unannounced && (
          <HideCard
            gameId={card.game_id}
            ply={card.ply}
            prominent={!!card.leech}
          />
        )}
      </VerdictSheet>
    ) : undefined;

  const actions = asking ? (
    question.none ? (
      <ActionButton
        icon="forward"
        label={question.none.label}
        accessibilityLabel={question.none.accessibilityLabel}
        primary
        disabled={!e?.entered}
        onPress={() => session.answerThreat(NO_THREAT)}
      />
    ) : null
  ) : threatShown ? null : phase === 'uncertain' || phase === 'checking' ? (
    <ActionButton
      icon="retry"
      label="Check saved progress"
      primary
      disabled={phase === 'checking'}
      onPress={() => void session.checkSaved()}
    />
  ) : phase === 'error' ? (
    <ActionButton
      icon="retry"
      label="Reload"
      primary
      onPress={() => void session.load()}
    />
  ) : phase === 'complete' ? (
    <>
      <ActionButton
        icon="retry"
        label="Refresh"
        onPress={() => void session.load()}
      />
      <ActionButton icon="forward" label="Done" primary onPress={onExit} />
    </>
  ) : shown ? (
    <ActionButton
      icon="hint"
      label={e?.hintLevel ? 'Show move' : 'Hint'}
      // "Your move" gives no hint: one would say there is something to find.
      disabled={
        !e?.entered ||
        phase !== 'ready' ||
        e.hintLevel >= 2 ||
        !!card?.unannounced
      }
      onPress={() => void session.hint()}
    />
  ) : null;

  // One segment per position or puzzle, fixed for the whole visit.
  const progress = practiceProgress({
    deck: state.deck,
    lesson,
    extra,
    // A first answer saved on this position already counts.
    answered: !!shown?.acknowledged,
  });
  const misses = useMissCount(phase === 'wrong');
  // The item whose badge was tapped: its explanation stays until the next item, or a tap.
  const [explained, setExplained] = useState<typeof shown>(undefined);
  const squish = usePressSquish({ squash: tokens.motion.squash.control });
  // A family puzzle: the tactic of the position just solved, somewhere else. Saying so is
  // what makes it read as deliberate rather than as a random puzzle.
  const sameIdea = shownItem?.kind === 'puzzle' && !!shownItem.family;
  // A post's idea, announced (deck mode `taught`): the post names the puzzle,
  // so practice reads as the path's lesson rather than a random puzzle.
  const taught =
    shownItem?.kind === 'puzzle' && !sameIdea && shownItem.mode === 'taught'
      ? taughtAt(state.deck?.ward)
      : null;
  // An earlier post's idea, unannounced (deck mode `review`): the label says it
  // is mixed review, never which idea, so finding it is the learner's.
  const review =
    shownItem?.kind === 'puzzle' && !sameIdea && shownItem.mode === 'review';
  // The safety check, named every time it is practised: a question of its own, or
  // a card's threat step. Which part (threats, captures, their reply) it trains.
  const safety =
    shownItem?.kind === 'question'
      ? QUESTION_COPY[questionKind(shownItem)].check
      : asking || threatShown
        ? question.check
        : null;

  // The badge for the item shown, if it has one; tapping it explains it in the bubble.
  const badge: Badge | null = safety
    ? { kind: 'safety', part: safety }
    : shownItem?.kind !== 'puzzle'
      ? null
      : sameIdea
        ? { kind: 'same-idea' }
        : taught
          ? { kind: 'taught', place: taught.place, lesson: taught.lesson }
          : review
            ? { kind: 'review' }
            : { kind: 'rated', rating: shownItem.rating };
  const about = badge && explained === shown ? badgeAbout(badge) : null;

  const label = !intro && shown && badge && (
    // A lesson label above the prompt, as Duolingo marks a hard puzzle.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        safety
          ? `Safety check: ${safety.toLowerCase()}`
          : sameIdea
            ? 'Same idea as the position you just solved'
            : taught
              ? `Lesson at ${taught.place}: ${taught.lesson}`
              : review
                ? 'Mixed review'
                : `Puzzle rated ${shownItem?.kind === 'puzzle' ? shownItem.rating : ''}`
      }
      accessibilityHint="Explains this label"
      accessibilityState={{ expanded: !!about }}
      hitSlop={6}
      onPress={() => setExplained(about ? undefined : (shown ?? undefined))}
      onPressIn={squish.onPressIn}
      onPressOut={squish.onPressOut}
    >
      <Animated.View style={[styles.label, squish.style]}>
        <View style={styles.labelIcon}>
          <ActionIcon
            name={safety ? 'check' : 'best'}
            color={theme.colors.surface}
            size={14}
          />
        </View>
        <Text style={styles.labelText}>
          {safety
            ? `Safety check · ${safety}`
            : sameIdea
              ? 'Same idea'
              : taught
                ? `At ${taught.place.replace(/^The /, 'the ')}`
                : review
                  ? 'Mixed review'
                  : `Rated ${shownItem?.kind === 'puzzle' ? shownItem.rating : ''}`}
        </Text>
      </Animated.View>
    </Pressable>
  );
  const bubble = (
    <CoachBubble
      title={
        firstLoad ? loadingCoach.title : (intro?.title ?? about?.title ?? title)
      }
      body={
        firstLoad ? loadingCoach.body : (intro?.body ?? about?.body ?? body)
      }
      mood={firstLoad ? loadingCoach.mood : undefined}
      // An error fills the screen on its own: no board to keep still under it,
      // so the plaque takes the height its reason needs instead of clipping it.
      lines={phase === 'error' ? undefined : 2}
      tone={
        intro
          ? intro.tone
          : phase === 'wrong' || (threatShown && !e?.threat?.correct)
            ? 'wrong'
            : solved || threatShown
              ? 'right'
              : 'plain'
      }
    />
  );
  // From the wall, the label is the treeline's plaque and the coach speaks
  // from the battlements below the board.
  const coach = watch ? (
    bubble
  ) : (
    <>
      {/* The label's row is always reserved, so a puzzle's or safety label
          never pushes the board down (the board never moves). */}
      <View style={[styles.labelSlot, { height: labelHeight }]}>{label}</View>
      {bubble}
    </>
  );

  const finish = { label: 'Done', onPress: onExit };
  const ended = state.deck;
  if (
    phase === 'complete' &&
    ended &&
    (extra ? ended.extra?.done : ended.today.done || ended.puzzles?.done)
  )
    return (
      // Fades in over the lesson rather than cutting to it.
      <Animated.View key="end" entering={summaryIn} style={motion.fill}>
        <SessionBeats
          // The watch ends over the wall before its Results.
          held={watch ? raidsTurnedBack(ended) : 0}
          results={{
            ...practiceResults(ended, elapsed, session.pointsSummary()),
            ...(end?.tomorrowDue
              ? {
                  note: `${end.tomorrowDue} ${end.tomorrowDue === 1 ? 'position' : 'positions'} due tomorrow`,
                }
              : {}),
            title: extra
              ? 'Extra watch complete'
              : lesson
                ? 'Lesson complete'
                : ended.results.length
                  ? 'Practice complete'
                  : 'Puzzles complete',
          }}
          // Only the night's first watch keeps the streak: never an extra one.
          streak={extra ? null : end?.streak}
          mastered={end?.mastered}
          rankUp={end?.rankUp}
          posts={end?.posts}
          pending={end?.pending}
          finish={finish}
        />
      </Animated.View>
    );

  return (
    <Screen
      preset="fixed"
      // With progress the bar carries ✕ in place of the header (one row,
      // as on Duolingo), so the screen keeps the top inset itself.
      // From the wall the frame keeps it, so the sky reaches the top edge.
      safeAreaEdges={
        !watch && (Platform.OS === 'web' || progress || firstLoad)
          ? ['top']
          : []
      }
      // From the wall, the night sky runs up behind the status bar.
      style={watch ? { backgroundColor: wallView.far.sky[0] } : undefined}
    >
      <LessonFrame
        watch={watch}
        plaque={watch ? label : undefined}
        raid={intro ? undefined : raid}
        bars={
          <>
            <LessonHeader
              hidden={!!progress || firstLoad}
              title={
                extra
                  ? 'Extra watch'
                  : lesson
                    ? 'Daily lesson'
                    : puzzle
                      ? 'Puzzle'
                      : 'Practice'
              }
              onClose={onExit}
              closeLabel="Exit practice, progress is saved"
            />
            {firstLoad && (
              <LessonTopBar
                loading
                done={0}
                current={0}
                total={0}
                onExit={onExit}
                exitLabel="Exit practice, progress is saved"
              />
            )}
            {progress && (
              <LessonTopBar
                done={progress.done}
                current={progress.done}
                total={progress.total}
                combo={state.combo}
                misses={misses}
                points={state.points ?? 0}
                award={state.award}
                onExit={onExit}
                exitLabel="Exit practice, progress is saved"
              />
            )}
          </>
        }
        coach={coach}
        board={intro?.board ?? shownBoard}
        fallback={
          <ScrollView
            style={styles.fill}
            // An error has nothing under it, so its words sit in the middle of
            // the scene instead of hanging from the treeline over empty sky.
            contentContainerStyle={[
              styles.content,
              phase === 'error' && styles.centred,
            ]}
          >
            {coach}
            {phase === 'complete' && state.deck && (
              <Summary deck={state.deck} />
            )}
          </ScrollView>
        }
        orientation={(intro?.board ?? shownBoard)?.orientation ?? 'w'}
        award={state.award}
        reserve={belowHeight}
        below={
          <>
            {firstLoad && (
              <View style={styles.meta}>
                <SkeletonLine width="55%" />
              </View>
            )}
            {shown && !intro && (
              <View style={styles.meta}>
                <View style={styles.who}>
                  <Avatar
                    name={shownCard?.opponent ?? '?'}
                    uri={shownCard?.opponent_avatar ?? undefined}
                    size={18}
                  />
                  <Text style={styles.muted} numberOfLines={1}>
                    {shownCard
                      ? `vs ${shownCard.opponent ?? 'Unknown opponent'} · Move ${shownCard.move_number}`
                      : shownItem?.kind === 'question'
                        ? `vs ${shownItem.opponent ?? 'Unknown opponent'}`
                        : ''}
                  </Text>
                </View>
                {theme_ && (
                  <Text
                    style={styles.tag}
                    accessibilityLabel={`Theme: ${theme_}`}
                  >
                    {theme_}
                  </Text>
                )}
              </View>
            )}
            {e && line && !intro && (
              <LineSteps
                view={e.view ?? line.uci.length}
                san={line.san}
                onStep={session.step}
              />
            )}
          </>
        }
        sheet={sheet}
        actions={
          intro ? (
            <ActionBar>
              {intro.actions.map((a) => (
                <ActionButton
                  key={a.label}
                  icon={a.icon}
                  label={a.label}
                  primary={a.primary}
                  disabled={a.disabled}
                  onPress={a.onPress}
                />
              ))}
            </ActionBar>
          ) : (
            actions && <ActionBar>{actions}</ActionBar>
          )
        }
        fadeSheet
      />
    </Screen>
  );
}

function Summary({ deck }: { deck: Deck }) {
  const styles = useStyles();
  const growth = deckGrowth(
    deck.total,
    deck.games,
    deck.puzzles?.available ?? false,
  );
  return (
    <View style={styles.summary}>
      <Text style={styles.muted}>
        {growth.kind === 'analyzing' || growth.kind === 'clean'
          ? growth.text
          : deck.total
            ? 'Your next positions are not due yet.'
            : growth.kind === 'no-games'
              ? 'Connect a chess account to build your deck from your games.'
              : 'Practice becomes available as your imported games are analyzed.'}
      </Text>
      {growth.kind === 'no-games' && (
        <Button
          variant="secondary"
          onPress={() => router.push('/connect-games')}
        >
          Connect games
        </Button>
      )}
      {growth.kind === 'small' && (
        <Text style={styles.muted}>{growth.text}</Text>
      )}
      {deck.total > 0 && (
        <Text style={styles.muted}>
          {deck.mastered} mastered · {deck.learning} learning · {deck.new} not
          seen yet
        </Text>
      )}
    </View>
  );
}

// The results fade in over the lesson rather than cutting to it.
const summaryIn = FadeIn.duration(tokens.motion.pop);
const motion = NativeStyleSheet.create({ fill: { flex: 1 } });

const useStyles = createStyles((theme) => ({
  fill: { flex: 1 },
  content: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  centred: { flexGrow: 1, justifyContent: 'center' },
  labelSlot: { justifyContent: 'center', marginBottom: -theme.spacing.xs },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  labelIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.sky,
  },
  labelText: {
    color: theme.colors.sky,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    flexShrink: 1,
  },
  muted: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  tag: {
    overflow: 'hidden',
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
  },
  summary: { gap: theme.spacing.md },
}));
