import { type ReactNode, useId, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { decorative } from '../ui/reward-effects';
import { useCharacter } from './registry';
import { actorBox, SceneView } from './scene';
import { SpriteNodes, SpriteView } from './sprite';
import type { Sprite, WallView } from './types';

// The `scene.wallView` role drawn as the lesson's backdrop (docs/specs/
// 2026-10-18-watch-story-design.md, "During the watch: looking out from the
// wall"). All decorative: the lesson labels what matters.

const svgHidden =
  Platform.OS === 'web' ? ({ 'aria-hidden': true } as const) : decorative;

/** The far band behind the lesson's bars: the scene pinned to its bottom,
 * the sky's top colour above it. `height` is the band's. `raiders` fills
 * the treeline's raiders slot, given the slot's height, behind the trees. */
export function WallViewFar({
  view,
  height,
  raiders,
}: {
  view: WallView;
  height: number;
  raiders?: (height: number) => ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      style={[styles.fill, { backgroundColor: view.far.sky[0] }]}
    >
      {/* The art sits at the band's foot; its sky and stars run on up to the
          band's top (under the status bar), not a flat colour. */}
      <View style={[styles.farScene, { top: 0 }]}>
        <SceneView
          scene={view.far}
          above={Math.max(0, height - view.far.height)}
          renderActor={(slot) =>
            slot.id === 'raiders' && raiders ? (
              <View
                style={[styles.raiders, { top: slot.top, height: slot.height }]}
              >
                {raiders(slot.height)}
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}

/** The treeline's ragged edge, tiled across the full width; the caller hangs
 * it `view.fringe.overlap` points over the board's top edge. */
export function WallViewFringe({ view }: { view: WallView }) {
  const [width, setWidth] = useState(0);
  const sprite = view.fringe.sprite;
  const [w, h] = sprite.viewBox;
  return (
    <View
      pointerEvents="none"
      style={[styles.fringe, { height: h }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...svgHidden}
    >
      {Array.from({ length: Math.ceil(width / w) }, (_, i) => (
        <Svg
          // biome-ignore lint/suspicious/noArrayIndexKey: identical repeated tiles
          key={i}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={[styles.tile, { left: i * w }]}
        >
          <SpriteNodes nodes={sprite.layers} />
        </Svg>
      ))}
    </View>
  );
}

/** The battlements under the board, `height` tall: the knight behind them
 * looking out, his lantern's light in front. `column` places the knight in
 * the lesson's centred column on a wide screen. */
export function WallViewNear({
  view,
  height,
  column,
}: {
  view: WallView;
  height: number;
  column?: Readonly<{ left: number; width: number }>;
}) {
  const knight = useCharacter('character.knight').states.lookout;
  return (
    <View pointerEvents="none" style={styles.fill}>
      <SceneView
        scene={view.near}
        height={height}
        actorFrame={column}
        renderActor={(slot) =>
          slot.id === 'knight' ? (
            <View style={actorBox(slot)}>
              <SpriteView sprite={knight} size={slot.height} />
            </View>
          ) : slot.id === 'knightLight' ? (
            <View style={actorBox(slot)}>
              <LanternLight sprite={knight} size={slot.height} view={view} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

/** The knight's place on the wall: where the words beside him start (in
 * the column) and how far down he reaches. */
export function wallViewKnight(view: WallView, columnWidth: number) {
  const slot = view.near.items.find((item) => item.id === 'knight');
  if (slot?.kind !== 'actor') return { inset: 0, bottom: 0 };
  return {
    inset:
      slot.left === undefined
        ? columnWidth - (slot.right ?? 0)
        : (Number.parseFloat(slot.left) / 100) * columnWidth + slot.width,
    bottom: slot.top + slot.height,
  };
}

/** A soft glow centred on the knight's `lantern` anchor. */
function LanternLight({
  sprite,
  size,
  view,
}: {
  sprite: Sprite;
  size: number;
  view: WallView;
}) {
  const id = `lantern-${useId().replace(/:/g, '')}`;
  const anchor = sprite.anchors?.lantern;
  if (!anchor) return null;
  const scale = size / sprite.viewBox[1];
  const r = view.light.radius;
  return (
    <Svg
      width={r * 2}
      height={r * 2}
      style={{
        position: 'absolute',
        left: anchor.x * scale - r,
        top: anchor.y * scale - r,
      }}
      {...svgHidden}
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={view.light.core} stopOpacity={0.55} />
          <Stop offset="0.4" stopColor={view.light.color} stopOpacity={0.2} />
          <Stop offset="1" stopColor={view.light.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

// Fixed scene geometry; colours come from the art.
const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  farScene: { position: 'absolute', left: 0, right: 0 },
  raiders: { position: 'absolute', left: 0, right: 0 },
  fringe: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  tile: { position: 'absolute', top: 0 },
});
