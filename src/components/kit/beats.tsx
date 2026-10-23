import type { Color, PieceSymbol, Square } from 'chess.js';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Piece } from '../../chess/board/piece';
import { squareOrigin } from '../../chess/coordinates';
import { createStyles, useTheme } from '../../theme/theme';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { Sparkles } from '../ui/reward-effects';
import { watchColors as c } from './art/wall-art';
import { frameAt, isNight, praiseFor } from './recipe';
import { usePraiseWords, useRecipe } from './registry';
import type { Recipe } from './types';

/**
 * A moment of board juice, placed by square. `id` changes each time it should
 * play again (a new answer).
 */
export type BoardEffect =
  | Readonly<{
      kind: 'capturePop';
      id: string;
      square: Square;
      piece: Readonly<{ kind: PieceSymbol; color: Color }>;
      points: number;
    }>
  | Readonly<{ kind: 'lineLight'; id: string; from: Square; to: Square }>
  | Readonly<{ kind: 'praise'; id: string; run: number }>;

const hidden = {
  pointerEvents: 'none',
  accessible: false,
  importantForAccessibility: 'no-hide-descendants',
  accessibilityElementsHidden: true,
} as const;

/** The centre of `square` on a board `size` wide. */
function centre(square: Square, orientation: Color, size: number) {
  const cell = size / 8;
  const origin = squareOrigin(square, orientation, cell);
  return { x: origin.x + cell / 2, y: origin.y + cell / 2 };
}

/** Runs a recipe's progress 0 → 1 once on mount; stays at 0 under reduced
 * motion (each beat then shows nothing: its recipes end invisible). */
export function useRecipeProgress(recipe: Recipe): SharedValue<number> {
  const reduced = useSystemReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    progress.set(
      withDelay(
        recipe.delay ?? 0,
        withTiming(1, {
          duration: recipe.duration,
          easing:
            recipe.easing === 'out' ? Easing.out(Easing.cubic) : Easing.linear,
        }),
      ),
    );
    return () => cancelAnimation(progress);
  }, [reduced, progress, recipe]);
  return progress;
}

/** A recipe's keyframes for now: its night version after 21:00. */
export function keyframesOf(recipe: Recipe) {
  return (isNight(new Date()) && recipe.night) || recipe.keyframes;
}

/** Over the board, at its size: plays each effect once when its id is new.
 * Effects ignore touches and are hidden from assistive technology; reduced
 * motion shows none of them (the board's own flash still marks the answer). */
export function BoardEffects({
  effects,
  orientation,
  size,
}: {
  effects: readonly BoardEffect[];
  orientation: Color;
  size: number;
}) {
  const reduced = useSystemReducedMotion();
  if (reduced || size <= 0) return null;
  return (
    <View {...hidden} style={StyleSheet.absoluteFill}>
      {effects.map((effect) =>
        effect.kind === 'capturePop' ? (
          <CapturePop
            key={effect.id}
            effect={effect}
            orientation={orientation}
            size={size}
          />
        ) : effect.kind === 'lineLight' ? (
          <LineLight
            key={effect.id}
            effect={effect}
            orientation={orientation}
            size={size}
          />
        ) : (
          <PraiseWord key={effect.id} run={effect.run} size={size} />
        ),
      )}
    </View>
  );
}

/** The captured piece swells and bursts into sparks in its own colour, and
 * "+points" rises off the square. */
function CapturePop({
  effect,
  orientation,
  size,
}: {
  effect: Extract<BoardEffect, { kind: 'capturePop' }>;
  orientation: Color;
  size: number;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const swellRecipe = useRecipe('fx.capturePop.swell');
  const scoreRecipe = useRecipe('fx.capturePop.score');
  const swell = useRecipeProgress(swellRecipe);
  const score = useRecipeProgress(scoreRecipe);
  const swellKeys = keyframesOf(swellRecipe);
  const scoreKeys = keyframesOf(scoreRecipe);
  const cell = size / 8;
  const at = centre(effect.square, orientation, size);
  const piece = useAnimatedStyle(() => {
    const p = swell.get();
    return {
      opacity: p > 0 ? frameAt(swellKeys, 'opacity', p, 0) : 0,
      transform: [{ scale: frameAt(swellKeys, 'scale', p, 1) }],
    };
  });
  const rise = useAnimatedStyle(() => {
    const p = score.get();
    return {
      opacity: p > 0 ? frameAt(scoreKeys, 'opacity', p, 0) : 0,
      transform: [
        { translateY: frameAt(scoreKeys, 'translateY', p, 0) * cell },
        { scale: frameAt(scoreKeys, 'scale', p, 1) },
      ],
    };
  });
  const sparkMs = swellRecipe.duration + 150;
  return (
    <View
      style={[
        styles.cell,
        {
          left: at.x - cell / 2,
          top: at.y - cell / 2,
          width: cell,
          height: cell,
        },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.centre, piece]}>
        <Piece
          kind={effect.piece.kind}
          color={effect.piece.color}
          size={cell * 0.9}
        />
      </Animated.View>
      <View style={styles.centre}>
        <Sparkles
          fire={effect.id}
          color={c.raiderPiece}
          reach={cell * 0.9}
          duration={sparkMs}
        />
        <Sparkles
          fire={effect.id}
          color={theme.colors.gold}
          reach={cell * 0.6}
          duration={sparkMs}
          delay={60}
        />
      </View>
      <Animated.View style={[styles.score, rise]}>
        <Text style={styles.scoreText}>+{effect.points}</Text>
      </Animated.View>
    </View>
  );
}

/** Light traces what the solving move controls: a beam from the moved piece
 * to the square it now guards, then that square glows. */
function LineLight({
  effect,
  orientation,
  size,
}: {
  effect: Extract<BoardEffect, { kind: 'lineLight' }>;
  orientation: Color;
  size: number;
}) {
  const styles = useStyles();
  const beamRecipe = useRecipe('fx.lineLight.beam');
  const glowRecipe = useRecipe('fx.lineLight.glow');
  const beam = useRecipeProgress(beamRecipe);
  const glow = useRecipeProgress(glowRecipe);
  const beamKeys = keyframesOf(beamRecipe);
  const glowKeys = keyframesOf(glowRecipe);
  const cell = size / 8;
  const a = centre(effect.from, orientation, size);
  const b = centre(effect.to, orientation, size);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const line = useAnimatedStyle(() => {
    const p = beam.get();
    return {
      opacity: p > 0 && p < 1 ? frameAt(beamKeys, 'opacity', p, 0) : 0,
      width: length * frameAt(beamKeys, 'grow', p, 0),
    };
  });
  const square = useAnimatedStyle(() => {
    const p = glow.get();
    return {
      opacity: p > 0 ? frameAt(glowKeys, 'opacity', p, 0) : 0,
      transform: [{ scale: frameAt(glowKeys, 'scale', p, 1) }],
    };
  });
  return (
    <>
      <Animated.View
        style={[
          styles.beam,
          { left: a.x, top: a.y - 3, transform: [{ rotate: `${angle}rad` }] },
          line,
        ]}
      />
      <Animated.View
        style={[
          styles.guarded,
          {
            left: b.x - cell / 2,
            top: b.y - cell / 2,
            width: cell,
            height: cell,
          },
          square,
        ]}
      />
    </>
  );
}

/** A gold display word over the board's middle, growing with the run. */
function PraiseWord({ run, size }: { run: number; size: number }) {
  const styles = useStyles();
  const recipe = useRecipe('fx.praise');
  const praise = praiseFor(usePraiseWords(), run);
  const progress = useRecipeProgress(recipe);
  const keys = keyframesOf(recipe);
  const scale = praise?.scale ?? 1;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p > 0 ? frameAt(keys, 'opacity', p, 0) : 0,
      transform: [
        { rotate: '-6deg' },
        { scale: scale * frameAt(keys, 'scale', p, 1) },
      ],
    };
  });
  if (!praise) return null;
  return (
    <Animated.View
      style={[styles.praise, { top: size / 2 - 40, width: size }, style]}
    >
      <Text style={styles.praiseText}>{praise.word}</Text>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  cell: { position: 'absolute', overflow: 'visible' },
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: -8,
    alignItems: 'center',
  },
  scoreText: {
    fontFamily: theme.typography.heading,
    fontSize: 24,
    color: theme.colors.gold,
    textShadowColor: c.outline,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  beam: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: c.lanternCore,
    transformOrigin: 'left center',
    shadowColor: c.lantern,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  guarded: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: theme.colors.gold,
    backgroundColor: c.guardedFill,
  },
  praise: { position: 'absolute', left: 0, alignItems: 'center' },
  praiseText: {
    fontFamily: theme.typography.heading,
    fontSize: 52,
    color: theme.colors.gold,
    textShadowColor: c.outline,
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 0,
  },
}));
