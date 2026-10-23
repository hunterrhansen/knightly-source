import { type ReactNode, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SpriteNodes, SpriteView } from './sprite';
import type { Scene, SceneItem, Sprite } from './types';

type ActorItem = Extract<SceneItem, { kind: 'actor' }>;

/**
 * Draws a kit scene: its sky, then its items back to front. Tiled layers move
 * with `camera` times their parallax and wrap so they never run out; fixed
 * layers stay put; actor slots are filled by `renderActor` at their depth (the
 * knight behind the wall, his light in front). Decorative: the screen labels
 * what matters.
 */
export function SceneView({
  scene,
  camera,
  renderActor,
  radius = scene.radius,
  pinned,
  actorFrame,
  height = scene.height,
  above = 0,
  nudge,
}: {
  scene: Scene;
  /** Sprites drawn in place of pinned layers' own, by layer id: tonight's
   * moon phase in the `moon` layer. */
  pinned?: Readonly<Record<string, Sprite>>;
  /** Corner radius in place of the scene's own: 0 for a full-bleed scene. */
  radius?: number;
  /** The frame's height, when it differs from the scene's: the art keeps its
   * height from the top, and the sky's bottom colour fills below. */
  height?: number;
  /** Extra sky above the art, in points: the sky's fade and its back layer
   * (the stars) run on up, under a clear header. The art keeps its place
   * below it. */
  above?: number;
  /** Moves fixed layers by id, in points (the moon left of a sheet's ✕). */
  nudge?: Readonly<Record<string, Readonly<{ right?: number; top?: number }>>>;
  /** Where actor slots' shares are measured: a centred column inside a
   * full-width scene (the lesson on a wide screen). The whole width if unset. */
  actorFrame?: Readonly<{ left: number; width: number }>;
  /** Camera travel; a still scene passes none. */
  camera?: SharedValue<number>;
  renderActor?: (slot: ActorItem) => ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const sky = `scene-sky-${useId().replace(/:/g, '')}`;
  const tiles = Math.ceil(width / scene.tile) + 1;
  const back = scene.items[0]?.kind === 'tiled' ? scene.items[0] : undefined;
  return (
    <View
      style={[
        styles.scene,
        {
          height: above + height,
          borderRadius: radius,
          backgroundColor: scene.fill ?? scene.sky[1],
        },
      ]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Svg
        style={[styles.sky, { height: above + scene.height }]}
        width="100%"
        height={above + scene.height}
      >
        <Defs>
          <LinearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={scene.sky[0]} />
            <Stop offset="1" stopColor={scene.sky[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${sky})`} />
      </Svg>
      {back && above > 0 && (
        // Mirrored, so the stars above don't repeat the ones below.
        <View style={[styles.above, { height: above }]}>
          <TiledLayer
            sprite={back.sprite}
            parallax={back.parallax}
            camera={camera}
            tile={scene.tile}
            tiles={tiles}
          />
        </View>
      )}
      <View style={[styles.art, { top: above, height }]}>
        {scene.items.map((item) => {
          if (item.kind === 'tiled')
            return (
              <TiledLayer
                key={item.id}
                sprite={item.sprite}
                parallax={item.parallax}
                camera={camera}
                tile={scene.tile}
                tiles={tiles}
              />
            );
          if (item.kind === 'fixed')
            return (
              <View
                key={item.id}
                pointerEvents="none"
                style={[
                  styles.fixed,
                  {
                    top: item.top + (nudge?.[item.id]?.top ?? 0),
                    right: item.right + (nudge?.[item.id]?.right ?? 0),
                  },
                ]}
              >
                <SpriteView
                  sprite={pinned?.[item.id] ?? item.sprite}
                  size={item.size}
                />
              </View>
            );
          return (
            <View
              key={item.id}
              pointerEvents="none"
              style={[
                styles.actorLayer,
                actorFrame && { ...actorFrame, right: undefined },
              ]}
            >
              {renderActor?.(item)}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** One tiled layer: its sprite repeated across the width, shifted by the
 * camera times `parallax` and wrapped. */
function TiledLayer({
  sprite,
  parallax,
  camera,
  tile,
  tiles,
}: {
  sprite: Sprite;
  parallax: number;
  camera?: SharedValue<number>;
  tile: number;
  tiles: number;
}) {
  const style = useAnimatedStyle(() => {
    const shift = ((camera?.get() ?? 0) * parallax) % tile;
    return {
      transform: [{ translateX: -(shift < 0 ? shift + tile : shift) }],
    };
  });
  const [w, h] = sprite.viewBox;
  return (
    <Animated.View style={[styles.layer, style]} pointerEvents="none">
      {Array.from({ length: tiles }, (_, i) => (
        <Svg
          // biome-ignore lint/suspicious/noArrayIndexKey: identical repeated tiles
          key={i}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={[styles.tile, { left: i * tile }]}
        >
          <SpriteNodes nodes={sprite.layers} />
        </Svg>
      ))}
    </Animated.View>
  );
}

/** An actor slot's box, for placing what fills it. */
export function actorBox(slot: ActorItem) {
  return {
    position: 'absolute',
    left: slot.left,
    right: slot.right,
    top: slot.top,
    width: slot.width,
    height: slot.height,
  } as const;
}

// Fixed scene geometry; colours come from the scene's art.
const styles = StyleSheet.create({
  scene: { overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  actorLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  tile: { position: 'absolute', top: 0 },
  sky: { position: 'absolute', left: 0, right: 0, top: 0 },
  above: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    transform: [{ scaleX: -1 }],
  },
  art: { position: 'absolute', left: 0, right: 0 },
  fixed: { position: 'absolute' },
});
