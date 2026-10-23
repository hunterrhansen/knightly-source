import { type ReactNode, useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import {
  actorBox,
  watchColors as c,
  SceneView,
  SpriteView,
  useCharacter,
  useScene,
} from '../../ui';

/** Camera travel per millisecond while idle: a slow walk along the wall. */
const DRIFT = 0.012;
const HOP = 14;
const GLOW = 120;

/**
 * The castle-wall watch as a side-scroller, drawn from the kit's
 * `scene.wallHero`: its layers slide at different speeds as the camera drifts
 * or is dragged sideways, while the knight (`character.knight`) stays put
 * behind the battlements. `cheer` changes when a raid is turned back: the
 * knight hops and the lantern flares. Reduced motion keeps the scene still.
 * Decorative: the lesson labels what matters.
 */
export function WallScene({ cheer }: { cheer: number }) {
  const reduced = useSystemReducedMotion();
  const scene = useScene('scene.wallHero');
  const knight = useCharacter('character.knight').states.lookout;
  const camera = useSharedValue(0);
  const dragging = useSharedValue(false);
  const motion = useKnightMotion(cheer, reduced);

  const drift = useFrameCallback((frame) => {
    if (dragging.get()) return;
    camera.set(camera.get() + (frame.timeSincePreviousFrame ?? 16) * DRIFT);
  }, false);
  useEffect(() => {
    drift.setActive(!reduced);
  }, [drift, reduced]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => dragging.set(true))
    .onChange((event) => camera.set(camera.get() - event.changeX))
    .onFinalize(() => dragging.set(false));

  // The light sits on the sprite's lantern anchor, so a redrawn knight keeps it.
  const lantern = knight.anchors?.lantern ?? { x: 0, y: 0 };

  return (
    <GestureDetector gesture={pan}>
      <SceneView
        scene={scene}
        camera={camera}
        renderActor={(slot) => {
          const scale = slot.height / knight.viewBox[1];
          if (slot.id === 'knight')
            return (
              <KnightFigure hop={motion.hop} box={actorBox(slot)}>
                <SpriteView sprite={knight} size={slot.height} />
              </KnightFigure>
            );
          if (slot.id === 'knightLight')
            return (
              <LanternGlow
                {...motion}
                box={actorBox(slot)}
                at={{ x: lantern.x * scale, y: lantern.y * scale }}
              />
            );
          return null;
        }}
      />
    </GestureDetector>
  );
}

/** The knight's motion: a lantern flicker (the scene's only loop) and, when
 * `cheer` changes, a hop up over the parapet with the lantern flaring. */
function useKnightMotion(cheer: number, reduced: boolean) {
  const hop = useSharedValue(0);
  const flare = useSharedValue(0);
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
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
  }, [flicker, reduced]);

  useEffect(() => {
    if (!cheer || reduced) return;
    hop.set(
      withSequence(
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 360, easing: Easing.bounce }),
      ),
    );
    flare.set(
      withSequence(
        withTiming(1, { duration: 160 }),
        withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [cheer, reduced, hop, flare]);

  return { hop, flare, flicker };
}

type Box = ReturnType<typeof actorBox>;

/** The knight in his slot, hopping on a cheer. */
function KnightFigure({
  hop,
  box,
  children,
}: {
  hop: SharedValue<number>;
  box: Box;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -HOP * hop.get() }],
  }));
  return <Animated.View style={[box, style]}>{children}</Animated.View>;
}

/** The lantern's light, drawn over the wall so it spills onto the stones. */
function LanternGlow({
  hop,
  flare,
  flicker,
  box,
  at,
}: {
  hop: SharedValue<number>;
  flare: SharedValue<number>;
  flicker: SharedValue<number>;
  box: Box;
  at: { x: number; y: number };
}) {
  const glow = useAnimatedStyle(() => ({
    opacity: Math.min(1, flicker.get() * 0.8 + flare.get() * 0.4),
    transform: [
      { translateY: -HOP * hop.get() },
      { scale: 1 + flare.get() * 0.5 },
    ],
  }));
  return (
    <Animated.View style={box}>
      <Animated.View
        style={[
          { position: 'absolute', left: at.x - GLOW / 2, top: at.y - GLOW / 2 },
          glow,
        ]}
      >
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id="wall-lantern" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.lanternCore} stopOpacity={0.7} />
              <Stop offset="0.4" stopColor={c.lantern} stopOpacity={0.3} />
              <Stop offset="1" stopColor={c.lantern} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={GLOW / 2}
            cy={GLOW / 2}
            r={GLOW / 2}
            fill="url(#wall-lantern)"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
