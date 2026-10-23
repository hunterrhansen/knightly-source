import {
  createContext,
  type PropsWithChildren,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet as NativeStyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { bonusHaptic, coinHaptic, successHaptic } from '../../lib/haptics';
import type { PointsAward } from '../../lib/lesson-points';
import { usePreferences } from '../../theme/preferences';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { shootingStarHead } from '../kit/art/shooting-star-art';
import { Burst, decorative, FlyTo, type Point } from './reward-effects';
import { ShootingStar } from './shooting-star';
import { playSound } from './sounds';
import { StarShard } from './star-shard';

// Timings from the approved design, after Chess.com's puzzle points: the shard
// pops onto the square, then accelerates to the counter, which bursts when it
// lands. A run bonus then dims the board and a shooting star slams in.
const FLY_DELAY = 350;
const FLY_MS = 500;
/** When the shard reaches the counter. */
const LAND_MS = FLY_DELAY + FLY_MS;
const SLAM_START = LAND_MS + 100;
const DIM_MS = 2300;
const BOOM_DELAY = 200;
const BOOM_MS = 600;
const COIN_IN_DELAY = 700;
const COIN_IN_MS = 350;
const COIN_OUT_DELAY = 1350;
const COIN_OUT_MS = 500;
/** When the bonus coin reaches the counter. */
const BONUS_LAND_MS = SLAM_START + COIN_OUT_DELAY + COIN_OUT_MS;
const BURST_MS = 500;
// The counter's shard, a little larger than its old gem: four points fill less.
const COUNTER_SHARD = 20;
const popEase = Easing.bezier(...tokens.motion.popBezier);
const flyEase = Easing.bezier(0.5, 0, 0.8, 0);
const coinInEase = Easing.bezier(0.4, 0, 1, 1);
const coinOutEase = Easing.bezier(0.8, 0, 1, 1);
const PointsTarget = createContext<RefObject<View | null> | null>(null);

/** Wraps a lesson screen so the board's shards know where the counter is. */
export function PointsFlightProvider({ children }: PropsWithChildren) {
  const target = useRef<View | null>(null);
  return (
    <PointsTarget.Provider value={target}>{children}</PointsTarget.Provider>
  );
}

const centre = (view: View | null) =>
  new Promise<Point | undefined>((resolve) => {
    if (!view) return resolve(undefined);
    view.measureInWindow((x, y, width, height) =>
      resolve(
        width || height ? { x: x + width / 2, y: y + height / 2 } : undefined,
      ),
    );
  });

/** The top bar's points: a star shard and the total, counting each award in as
 * its shard lands (and its run bonus as the coin lands), with a gold burst. */
export function PointsCounter({
  points,
  award,
}: {
  points: number;
  award?: PointsAward;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const reduced = useSystemReducedMotion();
  const { sounds } = usePreferences().preferences;
  const target = useContext(PointsTarget);
  const [shown, setShown] = useState(points);
  const bump = useSharedValue(1);
  const [burst, setBurst] = useState(0);
  const seen = useRef(award?.id);

  // Read when a timer fires, so a re-render mid-flight never cancels it.
  const latest = useRef({ points, sounds });
  latest.current = { points, sounds };
  const flying = useRef(false);

  // The total follows `points`, except while a flight is counting it in.
  useEffect(() => {
    if (!flying.current) setShown(points);
  }, [points]);

  // Each award flies once, keyed by its id: a new award object for the same
  // award, a points refetch or a sound-setting change leaves the flight alone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: replays only for a new award id; other values are read through `latest`
  useEffect(() => {
    if (!award || award.id === seen.current) return;
    seen.current = award.id;
    const total = latest.current.points;
    if (reduced) {
      // Reduced motion skips the flight, not the reward: it lands at once.
      setShown(total);
      if (award.bonus) {
        bonusHaptic();
        playSound('coin-bonus', latest.current.sounds);
      } else {
        coinHaptic();
        playSound('coin', latest.current.sounds);
      }
      return;
    }
    flying.current = true;
    const before = total - award.base - award.bonus;
    setShown(before);
    const land = (
      value: number,
      haptic: () => void,
      sound: 'coin' | 'coin-bonus',
      last: boolean,
    ) => {
      if (last) flying.current = false;
      setShown(last ? latest.current.points : value);
      haptic();
      playSound(sound, latest.current.sounds);
      bump.set(
        withSequence(
          withTiming(1.28, { duration: 120 }),
          withTiming(1, { duration: 180 }),
        ),
      );
      setBurst((count) => count + 1);
    };
    const timers = [
      setTimeout(
        () => land(before + award.base, coinHaptic, 'coin', !award.bonus),
        LAND_MS,
      ),
    ];
    if (award.bonus)
      timers.push(
        setTimeout(
          () => land(total, bonusHaptic, 'coin-bonus', true),
          BONUS_LAND_MS,
        ),
      );
    return () => {
      for (const t of timers) clearTimeout(t);
      flying.current = false;
      setShown(latest.current.points);
    };
  }, [award?.id, reduced]);

  const bumped = useAnimatedStyle(() => ({
    transform: [{ scale: bump.get() }],
  }));
  return (
    <View
      accessible
      accessibilityLabel={`${points} points`}
      style={styles.counter}
    >
      <View ref={target ?? undefined} collapsable={false}>
        <Burst
          fire={burst}
          color={theme.colors.gold}
          style={motion.burst}
          duration={BURST_MS}
        />
        <StarShard size={COUNTER_SHARD} />
      </View>
      <Animated.View style={bumped}>
        <Text style={styles.count}>{shown}</Text>
      </Animated.View>
    </View>
  );
}

const squareOrigin = (
  square: string,
  orientation: 'w' | 'b',
  size: number,
  badge: number,
): Point => {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const s = size / 8;
  const col = orientation === 'w' ? file : 7 - file;
  const row = orientation === 'w' ? 7 - rank : rank;
  // The top-right corner, slightly inside, where move badges sit. A badge that
  // would hang past the board's right edge mirrors to the square's top left
  // instead: on a phone the board is edge to edge, so the screen would cut it
  // off. The top row holds it inside the board in the same way.
  const reach = badge / 2;
  const right = (col + 0.92) * s;
  return {
    x: right + reach > size ? (col + 0.08) * s : right,
    y: Math.max((row + 0.08) * s, reach),
  };
};

/** Over the board: each award's shard pops onto its square and flies to the
 * counter; a run bonus dims the board, blooms and slams a coin in, which
 * sheds a sparkle trail on its way to the counter. */
export function PointsFlight({
  award,
  orientation,
  size,
}: {
  award?: PointsAward;
  /** The board's bottom side. */
  orientation: 'w' | 'b';
  size: number;
}) {
  const reduced = useSystemReducedMotion();
  const [flight, setFlight] = useState<
    { award: PointsAward; from: Point; to: Point; boardTo: Point } | undefined
  >();
  const board = useRef<View>(null);
  const target = useContext(PointsTarget);
  const seen = useRef(award?.id);

  useEffect(() => {
    if (!award || award.id === seen.current) return;
    seen.current = award.id;
    if (reduced || !target) return;
    let alive = true;
    Promise.all([centre(board.current), centre(target.current)]).then(
      ([boardCentre, counter]) => {
        if (!alive || !boardCentre || !counter) return;
        const from = award.square
          ? squareOrigin(award.square, orientation, size, SHARD)
          : { x: size / 2, y: size / 2 };
        // Board-local coordinates of the counter.
        const to = {
          x: counter.x - (boardCentre.x - size / 2),
          y: counter.y - (boardCentre.y - size / 2),
        };
        setFlight({ award, from, to, boardTo: to });
      },
    );
    const done = setTimeout(
      () => alive && setFlight(undefined),
      award.bonus ? SLAM_START + DIM_MS + 50 : LAND_MS + 50,
    );
    return () => {
      alive = false;
      clearTimeout(done);
    };
  }, [award, reduced, target, orientation, size]);

  return (
    <View
      ref={board}
      collapsable={false}
      pointerEvents="none"
      style={motion.layer}
      {...decorative}
    >
      {flight && (
        <FlyingShard key={flight.award.id} from={flight.from} to={flight.to} />
      )}
      {flight?.award.bonus ? (
        <CoinSlam
          key={`${flight.award.id}:bonus`}
          amount={flight.award.bonus}
          size={size}
          to={flight.boardTo}
        />
      ) : null}
    </View>
  );
}

const SHARD = 30;

function FlyingShard({ from, to }: { from: Point; to: Point }) {
  return (
    <FlyTo
      from={from}
      to={to}
      size={SHARD}
      pop={{ duration: tokens.motion.pop, easing: popEase }}
      delay={FLY_DELAY}
      duration={FLY_MS}
      easing={flyEase}
      turn={90}
      endScale={0.6}
      endOpacity={0.2}
    >
      <StarShard size={SHARD} />
    </FlyTo>
  );
}

// The run bonus's shooting star: big enough for "+N" to sit inside its head.
const COIN = 140;

function CoinSlam({
  amount,
  size,
  to,
}: {
  amount: number;
  size: number;
  to: Point;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const dim = useSharedValue(0);
  const coinIn = useSharedValue(0);
  const coinOut = useSharedValue(0);
  const caption = useSharedValue(0);
  useEffect(() => {
    const at = (delay: number, run: () => void) =>
      setTimeout(run, SLAM_START + delay);
    const timers = [
      at(0, () =>
        dim.set(
          withSequence(
            withTiming(1, { duration: 280 }),
            withDelay(DIM_MS - 560, withTiming(0, { duration: 280 })),
          ),
        ),
      ),
      at(COIN_IN_DELAY, () => {
        successHaptic();
        coinIn.set(withTiming(1, { duration: COIN_IN_MS, easing: coinInEase }));
      }),
      at(500, () =>
        caption.set(
          withSequence(
            withTiming(1, { duration: 260 }),
            withDelay(780, withTiming(0, { duration: 260 })),
          ),
        ),
      ),
      at(COIN_OUT_DELAY, () =>
        coinOut.set(
          withTiming(1, { duration: COIN_OUT_MS, easing: coinOutEase }),
        ),
      ),
    ];
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [dim, coinIn, coinOut, caption]);
  const centreX = size / 2;
  const centreY = size / 2;
  const dimmed = useAnimatedStyle(() => ({ opacity: dim.get() * 0.72 }));
  const coin = useAnimatedStyle(() => {
    const i = coinIn.get();
    const o = coinOut.get();
    return {
      opacity: i * (1 - o),
      transform: [
        { translateX: centreX - COIN / 2 + (to.x - centreX) * o },
        { translateY: centreY - COIN / 2 + (to.y - centreY) * o },
        { rotate: `${o * 45}deg` },
        { scale: (2 - i) * (1 - o * 0.65) },
      ],
    };
  });
  const words = useAnimatedStyle(() => ({
    opacity: caption.get(),
    transform: [{ translateY: (1 - caption.get()) * 12 }],
  }));
  return (
    <>
      <View style={[motion.clip, { width: size, height: size }]}>
        <Animated.View
          style={[
            motion.fill,
            { backgroundColor: theme.colors.page },
            motion.dim,
            dimmed,
          ]}
        />
        <Burst
          fire={1}
          color={theme.colors.gold}
          delay={SLAM_START + BOOM_DELAY}
          duration={BOOM_MS}
          fromScale={0}
          toScale={1}
          peak={1}
          style={{
            width: size * 1.6,
            height: size * 1.6,
            left: -size * 0.3,
            top: -size * 0.3,
          }}
        />
      </View>
      {TRAIL.map((sparkle, index) => (
        <TrailSparkle
          key={sparkle.lag}
          sparkle={sparkle}
          index={index}
          progress={coinOut}
          from={{ x: centreX, y: centreY }}
          to={to}
        />
      ))}
      <Animated.View style={[motion.coin, coin]}>
        <ShootingStar size={COIN} />
        <Text style={[styles.coinText, motion.coinText]}>{`+${amount}`}</Text>
      </Animated.View>
      <Animated.View
        style={[
          motion.caption,
          { top: centreY + COIN / 2 + 8, width: size },
          words,
        ]}
      >
        <Text style={styles.captionTitle}>Run bonus</Text>
        <Text style={styles.captionBody}>{`${amount} points`}</Text>
      </Animated.View>
    </>
  );
}

// Sparkles shed behind the shooting star on its way to the counter: each
// follows the star's path a little later (`lag`, as a share of the flight),
// to one side of it (`side`, in points), smaller and fainter the further back.
const TRAIL = [
  { lag: 0.08, side: -7, size: 16 },
  { lag: 0.16, side: 6, size: 14 },
  { lag: 0.24, side: -4, size: 12 },
  { lag: 0.32, side: 8, size: 11 },
  { lag: 0.4, side: -6, size: 9 },
];
const SPARKLE_GOLD = '#ffe48a';
const sparklePath = (r: number) =>
  `M${r} 0Q${r} ${r} ${2 * r} ${r}Q${r} ${r} ${r} ${2 * r}Q${r} ${r} 0 ${r}Q${r} ${r} ${r} 0Z`;

function TrailSparkle({
  sparkle,
  index,
  progress,
  from,
  to,
}: {
  sparkle: (typeof TRAIL)[number];
  index: number;
  progress: SharedValue<number>;
  from: Point;
  to: Point;
}) {
  const r = sparkle.size / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Perpendicular to the flight, for the sparkle's side offset.
  const nx = -dy / length;
  const ny = dx / length;
  const style = useAnimatedStyle(() => {
    const o = progress.get();
    const p = o - sparkle.lag;
    if (p <= 0 || o >= 1) return { opacity: 0 };
    return {
      opacity: (1 - index / TRAIL.length) * Math.min(1, p * 6),
      transform: [
        { translateX: from.x + dx * p + nx * sparkle.side - r },
        { translateY: from.y + dy * p + ny * sparkle.side - r },
        { rotate: `${p * 180}deg` },
        { scale: 1 - p * 0.4 },
      ],
    };
  });
  return (
    <Animated.View style={[motion.sparkle, style]}>
      <Svg width={2 * r} height={2 * r}>
        <Path d={sparklePath(r)} fill={SPARKLE_GOLD} />
      </Svg>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 48,
    justifyContent: 'flex-end',
  },
  count: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.heading,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  coinText: {
    color: '#ffffff',
    fontFamily: theme.typography.heading,
    fontSize: 24,
    textShadowColor: theme.colors.goldLedge,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  captionTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
  },
  captionBody: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.bold,
    fontSize: 14,
  },
}));

// Theme-independent styles for the flying shard and run bonus.
const motion = NativeStyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'visible',
  },
  burst: { left: -5, top: -5, width: 30, height: 30 },
  clip: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    borderRadius: 10,
  },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dim: { opacity: 0 },
  coin: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: COIN,
    height: COIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Over the shooting star's head, up and right of the box's centre.
  coinText: {
    position: 'absolute',
    transform: [
      { translateX: COIN * (shootingStarHead.x / 100 - 0.5) },
      { translateY: COIN * (shootingStarHead.y / 100 - 0.5) },
    ],
  },
  caption: { position: 'absolute', left: 0, alignItems: 'center', gap: 2 },
  sparkle: { position: 'absolute', left: 0, top: 0, opacity: 0 },
});
