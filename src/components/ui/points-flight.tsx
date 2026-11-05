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
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { bonusHaptic, coinHaptic } from '../../lib/haptics';
import type { PointsAward } from '../../lib/lesson-points';
import { usePreferences } from '../../theme/preferences';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { Burst, decorative, FlyTo, type Point } from './reward-effects';
import { playSound } from './sounds';
import { StarShard } from './star-shard';

// Timings from the approved design, after Chess.com's puzzle points: the shard
// pops onto the square, then accelerates to the counter, which bursts when it
// lands. Bonuses use the same brief flight, without covering the board.
const FLY_DELAY = 350;
const FLY_MS = 500;
/** When the shard reaches the counter. */
const LAND_MS = FLY_DELAY + FLY_MS;
const BURST_MS = 500;
// The counter's shard, a little larger than its old gem: four points fill less.
const COUNTER_SHARD = 20;
const popEase = Easing.bezier(...tokens.motion.popBezier);
const flyEase = Easing.bezier(0.5, 0, 0.8, 0);
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
    setShown(total - award.base - award.bonus);
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
          withTiming(1.12, { duration: 120 }),
          withTiming(1, { duration: 180 }),
        ),
      );
      setBurst((count) => count + 1);
    };
    const timers = [
      setTimeout(
        () =>
          land(
            total,
            award.bonus ? bonusHaptic : coinHaptic,
            award.bonus ? 'coin-bonus' : 'coin',
            true,
          ),
        LAND_MS,
      ),
    ];
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
 * counter, without dimming or covering the board. */
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
    const done = setTimeout(() => alive && setFlight(undefined), LAND_MS + 50);
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
});
