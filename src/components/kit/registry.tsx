import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { nightWatch } from './manifest';
import { rankEmblemOf } from './rank';
import { isNight, landingCurve } from './recipe';
import type {
  CastleState,
  CharacterRole,
  Manifest,
  RaiderKind,
  RecipeRole,
  SceneRole,
  SpriteFamilyRole,
  SpriteRole,
  SurfaceRole,
  WallHeroState,
  WallViewRole,
} from './types';

const Kit = createContext<Manifest>(nightWatch);

/** Replaces the kit below it: the gallery comparing candidates, a test. The
 * app runs on the nightWatch kit without a provider. */
export function KitProvider({
  kit,
  children,
}: {
  kit: Manifest;
  children: ReactNode;
}) {
  return <Kit.Provider value={kit}>{children}</Kit.Provider>;
}

/** The sprite that fills `role` in the current kit. */
export function useSprite(role: SpriteRole) {
  return useContext(Kit).sprites[role];
}

/** The distant skyline of a castle ward: none for the Outer Ward. */
export function useSkyline(
  ward: 'outer' | 'middle' | 'inner' | 'keep' | undefined,
) {
  const skylines = useContext(Kit).skylines;
  // The keep's own scene needs no keep looming behind it.
  return ward === 'middle' || ward === 'inner' ? skylines[ward] : null;
}

/** The landmark of the ward-path post `key`, or null when it has none yet. */
export function useLandmark(key: string | undefined) {
  const landmarks = useContext(Kit).landmarks;
  return (key && landmarks[key]) || null;
}

/** The sprite `role` draws for `n` (the moon at a streak day). */
export function useSpriteFamily(role: SpriteFamilyRole, n: number) {
  return useContext(Kit).families[role](n);
}

/** The character that fills `role`, with a sprite per state. */
export function useCharacter(role: CharacterRole) {
  return useContext(Kit).characters[role];
}

/** The emblem of a rank, by its server key ("squire-2") or, failing that,
 * its name ("Squire II"). An unknown tier draws Page's. */
export function useRankEmblem(rank: { key?: string; name: string }) {
  const { tier, level } = rankEmblemOf(rank);
  return useContext(Kit).emblems[`reward.rankEmblem.${tier}`](level);
}

/** A rank castle on the map of nights. */
export function useCastle(state: CastleState) {
  return useContext(Kit).characters['map.castle'].states[state];
}

/** The opponent's `kind` of piece as a raider at the treeline. */
export function useRaider(kind: RaiderKind) {
  return useContext(Kit).characters[`character.raider.${kind}`];
}

/** The raid's story copy: the word over a knocked-out raider. */
export function useRaidCopy() {
  return useContext(Kit).copy.raid;
}

/** The words over the gate and under the scene at the watch's end. */
export function useWatchEndCopy() {
  return useContext(Kit).copy.watchEnd;
}

/** The scene that fills `role` in `state` (before the watch by default). */
export function useScene(role: SceneRole, state: WallHeroState = 'before') {
  return useContext(Kit).scenes[role][state];
}

/** The recipe that fills `role`. */
export function useRecipe(role: RecipeRole) {
  return useContext(Kit).recipes[role];
}

/** How the board lands a moved piece in this kit (`fx.land`), calmer after
 * 21:00. Pass it as the board's `landing`. */
export function useLandingCurve() {
  const recipe = useContext(Kit).recipes['fx.land'];
  const night = isNight(new Date());
  return useMemo(() => landingCurve(recipe, night), [recipe, night]);
}

/** The kit's praise words for clean answers. */
export function usePraiseWords() {
  return useContext(Kit).copy.praise;
}

/** The lesson seen from the wall. */
export function useWallView(role: WallViewRole) {
  return useContext(Kit).views[role];
}

const InWatch = createContext(false);

/** Marks its children as drawn on the wall: the lesson's chrome below takes
 * its watch surfaces (parchment bubble, stone buttons). */
export function WatchSurfaces({ children }: { children: ReactNode }) {
  return <InWatch.Provider value>{children}</InWatch.Provider>;
}

/** The surface `role` draws on inside the watch frame; none outside it. */
export function useWatchSurface(role: SurfaceRole) {
  const surface = useContext(Kit).surfaces[role];
  return useContext(InWatch) ? surface : undefined;
}
