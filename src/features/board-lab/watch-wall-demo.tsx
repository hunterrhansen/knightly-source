import type { Color } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard, createTransition } from '../../chess/board';
import { applyMove } from '../../chess/move';
import { type PointsAward, pointsFor } from '../../lib/lesson-points';
import { createStyles } from '../../theme/theme';
import {
  type BoardEffect,
  BoardEffects,
  Button,
  LessonTopBar,
  PointsFlight,
  PointsFlightProvider,
  useLandingCurve,
} from '../../ui';
import { WallScene } from './wall-scene';

// kd_88's raid from the wireframes, as a two-move line: the bishop on c2 eyes
// f5, so Nd4 guards it; after ...h6 the knight takes the bishop that started it.
const raidFen = 'r5k1/5ppp/8/8/8/4P3/2b1N1PP/5RK1 w - - 0 1';
const guard = { from: 'e2', to: 'd4' } as const;
const reply = { from: 'h7', to: 'h6' } as const;
const take = { from: 'd4', to: 'c2' } as const;
const afterGuard = applyMove(raidFen, guard);
const afterReply = applyMove(afterGuard.fen, reply);
const afterTake = applyMove(afterReply.fen, take);
const LESSON = 10;
/** A beat after the guard lands before the opponent answers. */
const REPLY_DELAY = 650;
/** Longer than any move's travel plus its landing. */
const LANDING_FALLBACK = 1000;

type Step = 'guard' | 'guarded' | 'reply' | 'take' | 'taken';

/**
 * The castle-wall watch with board juice, development only: the parallax wall
 * over a two-move raid. Pieces land with a squash; the guarding move's line
 * lights up; the capture pops the bishop with "+10"; each clean answer gets a
 * praise word that grows with the run.
 */
export function WatchWallDemo({
  orientation,
  textScale,
}: {
  orientation: Color;
  textScale: number;
}) {
  const styles = useStyles();
  const [run, setRun] = useState(0);
  const [step, setStep] = useState<Step>('guard');
  const [combo, setCombo] = useState(0);
  const [points, setPoints] = useState(0);
  const [award, setAward] = useState<PointsAward>();
  const [effects, setEffects] = useState<readonly BoardEffect[]>([]);
  const landing = useLandingCurve();
  // The latest of each kind of effect; a new id plays it again.
  const play = (effect: BoardEffect) =>
    setEffects((list) => [
      ...list.filter((other) => other.kind !== effect.kind),
      effect,
    ]);
  const [cheer, setCheer] = useState(0);
  const [size, setSize] = useState(0);
  const handled = useRef(new Set<string>());
  const replyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(replyTimer.current);
      clearTimeout(fallbackTimer.current);
    },
    [],
  );

  const position =
    step === 'guard'
      ? { key: 'start', fen: raidFen }
      : step === 'guarded'
        ? { key: 'guarded', fen: afterGuard.fen }
        : step === 'taken'
          ? { key: 'taken', fen: afterTake.fen }
          : { key: 'replied', fen: afterReply.fen };
  const id = `wall-${run}-${position.key}`;
  const transition =
    step === 'guarded'
      ? createTransition(
          { id: `${id}:guard`, positionId: id, reason: 'confirmed' },
          afterGuard,
        )
      : step === 'reply'
        ? createTransition(
            { id: `${id}:reply`, positionId: id, reason: 'opponent' },
            afterReply,
          )
        : step === 'taken'
          ? createTransition(
              { id: `${id}:take`, positionId: id, reason: 'confirmed' },
              afterTake,
            )
          : undefined;
  const lastMove =
    step === 'guarded'
      ? guard
      : step === 'reply' || step === 'take'
        ? reply
        : step === 'taken'
          ? take
          : undefined;

  // A clean answer's reward, as a real lesson pays it when the piece lands.
  const reward = (square: string, tag: string) => {
    const next = combo + 1;
    const { base, bonus } = pointsFor('clean', next);
    setCombo(next);
    setPoints((value) => value + base + bonus);
    setAward({ id: `wall-${run}-${tag}`, base, bonus, square });
    play({ kind: 'praise', id: `praise-${run}-${tag}`, run: next });
    setCheer((value) => value + 1);
    return base + bonus;
  };

  const landed = (event: { transitionId: string }) => {
    if (handled.current.has(event.transitionId)) return;
    handled.current.add(event.transitionId);
    if (step === 'guarded') {
      reward(guard.to, 'guard');
      play({ kind: 'lineLight', id: `line-${run}`, from: guard.to, to: 'f5' });
      replyTimer.current = setTimeout(() => setStep('reply'), REPLY_DELAY);
    } else if (step === 'reply') setStep('take');
    else if (step === 'taken') {
      reward(take.to, 'take');
      play({
        kind: 'capturePop',
        id: `pop-${run}`,
        square: take.to,
        piece: { kind: 'b', color: 'b' },
        points: 10,
      });
    }
  };

  // If a move's completion never arrives, carry on anyway after the longest
  // move animation, so the raid can't stall; `landed` ignores a repeat.
  const latestLanded = useRef(landed);
  latestLanded.current = landed;
  const expectLanding = (transitionId: string) => {
    clearTimeout(fallbackTimer.current);
    fallbackTimer.current = setTimeout(
      () => latestLanded.current({ transitionId }),
      LANDING_FALLBACK,
    );
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: arms once per step
  useEffect(() => {
    if (step === 'guarded') expectLanding(`wall-${run}-guarded:guard`);
    else if (step === 'reply') expectLanding(`wall-${run}-replied:reply`);
    else if (step === 'taken') expectLanding(`wall-${run}-taken:take`);
  }, [step, run]);

  const nextRaid = () => {
    clearTimeout(replyTimer.current);
    clearTimeout(fallbackTimer.current);
    setRun((value) => value + 1);
    setStep('guard');
  };
  const resetRun = () => {
    nextRaid();
    setCombo(0);
    setPoints(0);
  };

  const moves =
    step === 'guard' ? [guard] : step === 'take' ? [take] : undefined;
  const caption =
    step === 'guard'
      ? 'From your game vs kd_88, move 14. What does their bishop threaten?'
      : step === 'guarded' || step === 'reply'
        ? 'Nd4! The knight guards f5. Their reply: ...h6.'
        : step === 'take'
          ? 'The bishop that started the raid is still on c2. Take it.'
          : 'Nxc2! Raid captain out. Line complete.';

  return (
    <PointsFlightProvider>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.heading}>
          Watch wall
        </Text>
        <Text style={styles.body(textScale)}>
          A two-move raid with board juice. Play Nd4, then take the bishop with
          Nxc2. Pieces land with a squash, the guarded square lights up, the
          capture pops with +10 and each clean answer gets a praise word that
          grows at 3, 5 and 10 in a row. Drag the wall sideways to look along
          it. Reduced motion keeps everything still.
        </Text>
        <View style={styles.controls}>
          <Button
            textScale={textScale}
            disabled={step !== 'taken'}
            onPress={nextRaid}
          >
            Next raid
          </Button>
          <Button textScale={textScale} onPress={resetRun}>
            Reset run
          </Button>
        </View>
        <View style={styles.lesson}>
          <LessonTopBar
            done={combo % LESSON}
            current={combo % LESSON}
            total={LESSON}
            combo={combo}
            points={points}
            award={award}
          />
          <WallScene cheer={cheer} />
          <View
            style={styles.board}
            onLayout={(event) => setSize(event.nativeEvent.layout.width)}
          >
            <Chessboard
              position={{ id, fen: position.fen }}
              orientation={orientation}
              policy={
                moves
                  ? {
                      mode: 'movable',
                      sides: ['w'],
                      submissionEnabled: true,
                      moves,
                    }
                  : { mode: 'read-only' }
              }
              presentation={{
                showDestinations: true,
                highlights: [],
                arrows: [],
                landing,
                correct:
                  step === 'guarded'
                    ? { square: guard.to, id: `${run}-guard` }
                    : step === 'taken'
                      ? { square: take.to, id: `${run}-take` }
                      : undefined,
                lastMove,
                transition,
              }}
              onAttempt={() => setStep(step === 'guard' ? 'guarded' : 'taken')}
              onTransitionComplete={landed}
            />
            {size > 0 && (
              <>
                <BoardEffects
                  effects={effects}
                  orientation={orientation}
                  size={size}
                />
                <PointsFlight
                  award={award}
                  orientation={orientation}
                  size={size}
                />
              </>
            )}
          </View>
          {/* Below the board with room for two lines, so a longer caption
              never moves the board. */}
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.body(textScale), styles.caption(textScale)]}
          >
            {caption}
          </Text>
        </View>
      </View>
    </PointsFlightProvider>
  );
}

const useStyles = createStyles((theme) => ({
  content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  heading: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 28,
  },
  body: (scale: number) => ({
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: 16 * scale,
  }),
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  lesson: {
    width: '100%',
    maxWidth: theme.layout.boardMax,
    gap: theme.spacing.md,
  },
  board: { width: '100%' },
  caption: (scale: number) => ({ minHeight: 2 * 24 * scale }),
}));
