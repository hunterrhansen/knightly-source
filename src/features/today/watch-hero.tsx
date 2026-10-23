import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import {
  actorBox,
  watchColors as c,
  moonPhaseForNight,
  SceneView,
  SpriteView,
  useCharacter,
  useLandmark,
  useScene,
  useSkyline,
  useSprite,
  useSpriteFamily,
} from '../../ui';
import { postBailey } from './ward-copy';

/** Which wall a node card draws: before the watch, kept, or the first night. */
export type WatchWall = 'before' | 'kept' | 'firstNight';

const pose = {
  before: 'lookout',
  kept: 'dozing',
  firstNight: 'arriving',
} as const;
/** The lantern's light in each state: raised and bright, turned low, unlit. */
const light = { before: 1, kept: 0.45, firstNight: 0 } as const;
const GLOW = 120;
/** The distant skyline's base, down in the hills, and its place left of the landmark. */
const SKYLINE_BASE = 152;
const SKYLINE_RIGHT = 196;
/** A post's landmark stands at the scene's right, its base behind the wall walk. */
const LANDMARK = { size: 164, top: 46, right: 24 } as const;

/**
 * The header of tonight's node card (docs/specs/2026-10-19-path-home-design.md,
 * "The node card"): the kit's wall scene in tonight's state, with the knight
 * in the matching pose and, while the lesson is under way, its progress as a
 * ring around him. The lantern's slow flicker is the scene's only loop and
 * stops under reduced motion. Decorative: the card's words say what it shows.
 */
export function WatchHero({
  wall,
  relit = false,
  night,
  progress,
  radius,
  clearTopRight = false,
  post,
}: {
  wall: WatchWall;
  /** On the ward path: the post whose landmark rises behind the wall. */
  post?: string;
  /** Keeps the top right clear for a sheet's close button: the moon moves
   * left of it. */
  clearTopRight?: boolean;
  /** Corners in place of the scene's own: 0 to run edge to edge. */
  radius?: number;
  /** A move stopped slipping tonight: its star burns in the kept sky. */
  relit?: boolean;
  /** Tonight's night in the streak, for the moon's phase (0: none yet). */
  night: number;
  /** The lesson under way: a ring around the knight fills with it. */
  progress?: { done: number; total: number };
}) {
  const styles = useStyles();
  const wallScene = useScene('scene.wallHero', wall);
  const landmark = useLandmark(post);
  // Deeper in the castle, the distant skyline changes (the Middle Ward's
  // rooftops, the Inner Ward's keep), behind the hills.
  const skyline = useSkyline(post ? postBailey(post) : undefined);
  const scene =
    landmark || skyline
      ? {
          ...wallScene,
          items: wallScene.items.flatMap((item) => {
            if (skyline && item.kind === 'tiled' && item.id === 'hills')
              return [
                {
                  kind: 'fixed' as const,
                  id: 'skyline',
                  sprite: skyline,
                  size: skyline.viewBox[1],
                  top: SKYLINE_BASE - skyline.viewBox[1],
                  right: SKYLINE_RIGHT,
                },
                item,
              ];
            // The landmark: in front of the treeline, behind the knight and wall.
            if (landmark && item.kind === 'actor' && item.id === 'knight')
              return [
                {
                  kind: 'fixed' as const,
                  id: 'landmark',
                  sprite: landmark,
                  ...LANDMARK,
                },
                item,
              ];
            return [item];
          }),
        }
      : wallScene;
  const knight = useCharacter('character.knight').states[pose[wall]];
  const star = useSprite('reward.starShard');
  const moon = useSpriteFamily('reward.moon', moonPhaseForNight(night));
  const flicker = useFlicker(light[wall] > 0);
  const lantern = knight.anchors?.lantern ?? { x: 0, y: 0 };
  return (
    <View
      style={styles.hero}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <SceneView
        scene={scene}
        radius={radius}
        nudge={clearTopRight ? { moon: { right: 56 } } : undefined}
        pinned={{ moon }}
        renderActor={(slot) => {
          const scale = slot.height / knight.viewBox[1];
          if (slot.id === 'knight')
            return (
              <View style={actorBox(slot)}>
                <SpriteView sprite={knight} size={slot.height} />
              </View>
            );
          if (slot.id === 'knightLight')
            return (
              <>
                {light[wall] > 0 && (
                  <LanternGlow
                    box={actorBox(slot)}
                    at={{ x: lantern.x * scale, y: lantern.y * scale }}
                    strength={light[wall]}
                    flicker={flicker}
                  />
                )}
                {progress && (
                  <ProgressRing box={actorBox(slot)} {...progress} />
                )}
              </>
            );
          if (slot.id === 'relitStar' && relit)
            return (
              <View style={actorBox(slot)}>
                <SpriteView sprite={star} size={slot.height} />
              </View>
            );
          return null;
        }}
      />
    </View>
  );
}

const RING = 84;
const RING_STROKE = 6;
/** The lesson's progress as a ring around the knight, as Continue watch
 * resumes it. */
function ProgressRing({
  box,
  done,
  total,
}: {
  box: ReturnType<typeof actorBox>;
  done: number;
  total: number;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const r = (RING - RING_STROKE) / 2;
  const length = 2 * Math.PI * r;
  const share = total ? Math.min(1, done / total) : 0;
  return (
    <View style={box}>
      <View style={styles.ring}>
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            fill="none"
            stroke={c.ringTrack}
            strokeWidth={RING_STROKE}
          />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            fill="none"
            stroke={theme.colors.brand}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${share * length} ${length}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
      </View>
    </View>
  );
}

/** The lantern's flicker, held still under reduced motion or with no light. */
function useFlicker(lit: boolean) {
  const reduced = useSystemReducedMotion();
  const flicker = useSharedValue(1);
  useEffect(() => {
    if (reduced || !lit) {
      flicker.set(1);
      return;
    }
    flicker.set(
      withRepeat(
        withSequence(
          withTiming(0.82, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(flicker);
  }, [flicker, reduced, lit]);
  return flicker;
}

/** The lantern's light, drawn over the wall so it spills onto the stones. */
function LanternGlow({
  box,
  at,
  strength,
  flicker,
}: {
  box: ReturnType<typeof actorBox>;
  at: { x: number; y: number };
  strength: number;
  flicker: SharedValue<number>;
}) {
  const size = GLOW * (0.6 + 0.4 * strength);
  const glow = useAnimatedStyle(() => ({
    opacity: flicker.get() * 0.8 * strength,
  }));
  return (
    <View style={box}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: at.x - size / 2,
            top: at.y - size / 2,
          },
          glow,
        ]}
      >
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="watch-lantern" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.lanternCore} stopOpacity={0.7} />
              <Stop offset="0.4" stopColor={c.lantern} stopOpacity={0.3} />
              <Stop offset="1" stopColor={c.lantern} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2}
            fill="url(#watch-lantern)"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  hero: { position: 'relative' },
  // Centred on the knight's helmet and shoulders, above the parapet.
  ring: {
    position: 'absolute',
    left: 30 - RING / 2,
    top: 30 - RING / 2,
  },
}));
