import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Text as SvgText } from 'react-native-svg';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { decorative } from '../ui/reward-effects';
import { raidColors } from './art/raider-art';
import { frameAt, isNight } from './recipe';
import { useRaidCopy, useRaider, useRecipe, useSprite } from './registry';
import { SpriteView } from './sprite';
import type { Raid, RaiderKind, RaiderState, RaidMood, Recipe } from './types';

// The opponent's pieces waiting at the treeline of the lesson's wall view
// (docs/specs/2026-10-18-watch-story-design.md, "During the watch: looking
// out from the wall"). They react only here, never on the board: a right
// answer sends them back into the trees, a wrong one brings them forward
// until the board rewinds, and a capture knocks that piece's raider out.
// Decorative: the lesson's coach and verdict say what happened.

const svgHidden =
  Platform.OS === 'web' ? ({ 'aria-hidden': true } as const) : decorative;

type Raider = Raid['raiders'][number];
type Keys = Recipe['keyframes'];

/** A recipe's keyframes for now: its night version after 21:00. */
function keyframesOf(recipe: Recipe): Keys {
  return (isNight(new Date()) && recipe.night) || recipe.keyframes;
}

/** Runs `progress` to `to` over the recipe's duration; jumps there under
 * reduced motion, so only the recipe's end frame (or its start) shows. */
function runTo(
  progress: SharedValue<number>,
  to: number,
  recipe: Recipe,
  reduced: boolean,
) {
  cancelAnimation(progress);
  if (reduced) {
    progress.set(to);
    return;
  }
  progress.set(
    withTiming(to, {
      duration: recipe.duration,
      easing:
        recipe.easing === 'out' ? Easing.out(Easing.cubic) : Easing.linear,
    }),
  );
}

/** Pieces that are bigger or smaller than most at the treeline. */
const kindScale: Readonly<Record<RaiderKind, number>> = {
  p: 0.8,
  n: 1,
  b: 1,
  r: 0.95,
  q: 1.05,
  k: 1.05,
};
const SPRITE_ASPECT = 40 / 48;

/**
 * The raid at the treeline, `height` tall, over the board's columns: each
 * raider stands above its board file (`board` is the board's left edge and
 * width in this view), nearer pieces a little lower and in front.
 */
export function WallViewRaiders({
  raid,
  board,
  height,
}: {
  raid: Raid;
  board: Readonly<{ left: number; width: number }>;
  height: number;
}) {
  // Knocked out stays out for the position, whatever the line steps back to.
  const outs = useRef<{ key: string; ids: Set<string> }>({
    key: raid.key,
    ids: new Set(),
  });
  if (outs.current.key !== raid.key)
    outs.current = { key: raid.key, ids: new Set() };
  for (const raider of raid.raiders)
    if (raider.out) outs.current.ids.add(raider.id);
  const square = board.width / 8;
  const files = new Map<number, Raider[]>();
  for (const raider of raid.raiders)
    files.set(raider.file, [...(files.get(raider.file) ?? []), raider]);
  return (
    <View
      pointerEvents="none"
      style={[styles.fill, { height }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {raid.raiders.map((raider) => {
        const stack = [...(files.get(raider.file) ?? [])].sort(
          (a, b) => a.depth - b.depth,
        );
        const i = stack.indexOf(raider);
        // Room above for edging in under the lesson's bars.
        const h = Math.min(height - 6, square * 0.8) * kindScale[raider.kind];
        return (
          <RaiderView
            // A new position brings new raiders, arriving from the trees.
            key={`${raid.key}:${raider.id}`}
            raider={raider}
            out={outs.current.ids.has(raider.id)}
            mood={raid.mood}
            captain={raid.captain?.id === raider.id}
            size={h}
            x={
              board.left +
              (raider.file + 0.5) * square +
              (i - (stack.length - 1) / 2) * square * 0.24
            }
            bottom={height - (raider.depth / 7) * 5}
            z={raider.depth * 10 + i}
          />
        );
      })}
    </View>
  );
}

function RaiderView({
  raider,
  out,
  mood,
  captain,
  size,
  x,
  bottom,
  z,
}: {
  raider: Raider;
  out: boolean;
  mood: RaidMood;
  captain: boolean;
  size: number;
  x: number;
  bottom: number;
  z: number;
}) {
  const reduced = useSystemReducedMotion();
  const character = useRaider(raider.kind);
  const crown = useSprite('character.raider.captain');
  const fallBack = useRecipe('fx.raidersFallBack');
  const edgeIn = useRecipe('fx.raidersEdgeIn');
  const knockOut = useRecipe('fx.raiderOut');
  const word = useRecipe('fx.raiderOut.word');
  const outWord = useRaidCopy().out;
  // The reaction it holds: progress 0 is waiting at the treeline for every
  // reaction, so a reaction plays forward and its reset plays it back.
  const [held, setHeld] = useState<'fallBack' | 'edgeIn'>('fallBack');
  const [pose, setPose] = useState<RaiderState>(out ? 'knockedOut' : 'lurk');
  // It arrives from the trees: the fall back, played in reverse.
  const progress = useSharedValue(out ? 0 : 1);
  const left = useSharedValue(x);
  const knocked = useSharedValue(out ? 1 : 0);
  const wordShown = useSharedValue(out ? 1 : 0);
  const wasOut = useRef(out);
  const heldKeys = keyframesOf(held === 'fallBack' ? fallBack : edgeIn);
  const outKeys = keyframesOf(knockOut);
  const wordKeys = keyframesOf(word);

  // biome-ignore lint/correctness/useExhaustiveDependencies: arrives once, on mount
  useEffect(() => {
    if (!out) runTo(progress, 0, fallBack, reduced);
  }, []);

  // The reaction held now, read by the mood's effect without replaying it.
  const heldNow = useRef(held);
  heldNow.current = held;
  useEffect(() => {
    const recipe = { fallBack, edgeIn };
    if (mood === 'lurk') {
      runTo(progress, 0, recipe[heldNow.current], reduced);
      setPose((p) => (p === 'knockedOut' ? p : 'lurk'));
      return;
    }
    setHeld(mood);
    progress.set(0);
    runTo(progress, 1, recipe[mood], reduced);
    if (mood === 'edgeIn') return;
    // Hit, then running back into the trees.
    setPose((p) => (p === 'knockedOut' ? p : 'flinch'));
    const turn = setTimeout(
      () => setPose((p) => (p === 'knockedOut' ? p : 'flee')),
      reduced ? 0 : fallBack.duration * 0.25,
    );
    return () => clearTimeout(turn);
  }, [mood, progress, reduced, fallBack, edgeIn]);

  useEffect(() => {
    if (!out || wasOut.current) return;
    wasOut.current = true;
    setPose('knockedOut');
    runTo(knocked, 1, knockOut, reduced);
    runTo(wordShown, 1, word, reduced);
  }, [out, knocked, wordShown, knockOut, word, reduced]);

  useEffect(() => {
    if (reduced) left.set(x);
    else left.set(withTiming(x, { duration: tokens.motion.move }));
  }, [x, left, reduced]);

  const w = size * SPRITE_ASPECT;
  const body = useAnimatedStyle(() => {
    const k = knocked.get();
    // Once knocked out it plays only its own recipe: the others' reaction
    // no longer moves it.
    const p = k > 0 ? 0 : progress.get();
    const scale =
      frameAt(heldKeys, 'scale', p, 1) * frameAt(outKeys, 'scale', k, 1);
    const ty =
      frameAt(heldKeys, 'translateY', p, 0) +
      frameAt(outKeys, 'translateY', k, 0);
    return {
      opacity:
        frameAt(heldKeys, 'opacity', p, 1) * frameAt(outKeys, 'opacity', k, 1),
      transform: [
        { translateX: left.get() - w / 2 },
        // Scaled from its feet, so it stays on the ground.
        { translateY: ty * size + ((1 - scale) * size) / 2 },
        { scale },
      ],
    };
  });
  const wordStyle = useAnimatedStyle(() => {
    const p = wordShown.get();
    return {
      opacity: frameAt(wordKeys, 'opacity', p, 0),
      transform: [
        { translateX: left.get() - size },
        { translateY: frameAt(wordKeys, 'translateY', p, 0) * size },
        { scale: frameAt(wordKeys, 'scale', p, 1) },
      ],
    };
  });
  const sprite = character.states[pose];
  const scale = size / sprite.viewBox[1];
  const head = sprite.anchors?.crown;
  const crownWidth = size * 0.5;
  const crownHeight = (crownWidth * crown.viewBox[1]) / crown.viewBox[0];
  const crownBase = crown.anchors?.base;
  return (
    <>
      <Animated.View
        style={[
          styles.raider,
          { width: w, height: size, top: bottom - size, zIndex: z },
          body,
        ]}
      >
        <SpriteView sprite={sprite} size={size} />
        {captain && head && crownBase && (
          <View
            style={{
              position: 'absolute',
              left:
                head.x * scale - (crownBase.x / crown.viewBox[0]) * crownWidth,
              // Worn low over its top, so it stays under the lesson's bars.
              top:
                head.y * scale -
                (crownBase.y / crown.viewBox[1]) * crownHeight +
                crownHeight * 0.45,
            }}
          >
            <SpriteView sprite={crown} size={crownHeight} />
          </View>
        )}
      </Animated.View>
      {wasOut.current && (
        <Animated.View
          style={[
            styles.word,
            // Just over the toppled raider.
            { width: size * 2, top: bottom - size * 0.55 - 14, zIndex: 100 },
            wordStyle,
          ]}
        >
          <Svg width={size * 2} height={16} {...svgHidden}>
            {(['edge', 'fill'] as const).map((layer) => (
              <SvgText
                key={layer}
                x={size}
                y={12}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
                fill={raidColors.word}
                stroke={layer === 'edge' ? raidColors.wordEdge : undefined}
                strokeWidth={layer === 'edge' ? 3 : undefined}
                strokeLinejoin="round"
              >
                {outWord}
              </SvgText>
            ))}
          </Svg>
        </Animated.View>
      )}
    </>
  );
}

/**
 * The raid captain's health on its plaque: one segment per move of the
 * line in its slot; a cracked one swells and empties from it.
 */
export function CaptainHealth({
  segments,
  cracked,
  height = 6,
}: {
  segments: number;
  cracked: number;
  height?: number;
}) {
  return (
    <View style={styles.health} {...svgHidden}>
      {Array.from({ length: segments }, (_, i) => (
        <HealthSegment
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
          key={i}
          cracked={i < cracked}
          height={height}
        />
      ))}
    </View>
  );
}

function HealthSegment({
  cracked,
  height,
}: {
  cracked: boolean;
  height: number;
}) {
  const reduced = useSystemReducedMotion();
  const recipe = useRecipe('fx.captainHit');
  const keys = keyframesOf(recipe);
  // Already cracked when it first shows: drawn at its end frame.
  const progress = useSharedValue(cracked ? 1 : 0);
  useEffect(() => {
    runTo(progress, cracked ? 1 : 0, recipe, reduced || !cracked);
  }, [cracked, progress, recipe, reduced]);
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: frameAt(keys, 'opacity', p, 1),
      transform: [{ scale: frameAt(keys, 'scale', p, 1) }],
    };
  });
  return (
    <View
      style={[
        styles.segment,
        { height, backgroundColor: raidColors.healthCracked },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.segmentFill,
          { backgroundColor: raidColors.health },
          style,
        ]}
      />
    </View>
  );
}

// Fixed raid geometry; colours come from the art.
const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0 },
  raider: { position: 'absolute', left: 0 },
  word: { position: 'absolute', left: 0, alignItems: 'center' },
  health: { flexDirection: 'row', gap: 2 },
  segment: { width: 10, borderRadius: 2 },
  segmentFill: { borderRadius: 2 },
});
