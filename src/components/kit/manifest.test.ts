import { nightWatch } from './manifest';
import { rankEmblemOf } from './rank';
import { frameAt, landingCurve } from './recipe';
import type {
  CastleState,
  Frame,
  KnightState,
  Manifest,
  RaiderKind,
  RaiderState,
  RaidRecipeRole,
  RankTier,
  Recipe,
  Scene,
  Sprite,
  SpriteNode,
  WallHeroState,
} from './types';

// The kit's contract (docs/specs/2026-10-18-watch-kit-design.md, "Contract
// tests"): a swapped sprite, character or scene that breaks what screens and
// effects rely on fails here, before anyone has to spot it on a device.

const kit: Manifest = nightWatch;

/** Every pose the screens ask the knight for. */
const knightStates: readonly KnightState[] = ['lookout', 'dozing', 'arriving'];
/** Every piece the opponent can have at the treeline, and every state the
 * lesson's wall view draws a raider in. */
const raiderKinds: readonly RaiderKind[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const raiderStates: readonly RaiderState[] = [
  'lurk',
  'flinch',
  'knockedOut',
  'flee',
];
const raidRecipes: readonly RaidRecipeRole[] = [
  'fx.raidersFallBack',
  'fx.raidersEdgeIn',
  'fx.raiderOut',
  'fx.raiderOut.word',
  'fx.captainHit',
];
/** Every rank tier the server's ranks name (backend watch.py RANKS), and the
 * castle's states on the map of nights. */
const rankTiers: readonly RankTier[] = ['page', 'squire', 'knight'];
const castleStates: readonly CastleState[] = ['reached', 'ahead'];
/** Every state the Watch page draws the wall in. */
const wallStates: readonly WallHeroState[] = [
  'before',
  'kept',
  'firstNight',
  'end',
];
const scenes = (): [string, Scene][] =>
  Object.entries(kit.scenes).flatMap(([role, states]) =>
    Object.entries(states).map(([state, scene]): [string, Scene] => [
      `${role}:${state}`,
      scene,
    ]),
  );

function layersOf(nodes: readonly SpriteNode[]): SpriteNode[] {
  return nodes.flatMap((node) =>
    node.kind === 'group' ? layersOf(node.layers) : [node],
  );
}

function spriteProblems(sprite: Sprite): string[] {
  const problems: string[] = [];
  const [w, h] = sprite.viewBox;
  if (!(w > 0 && h > 0)) problems.push('drawing box is empty');
  if (layersOf(sprite.layers).length === 0) problems.push('has no layers');
  if (!(sprite.sizes.min > 0 && sprite.sizes.min <= sprite.sizes.max))
    problems.push('sizes are out of order');
  for (const layer of layersOf(sprite.layers))
    if (layer.kind !== 'group' && layer.clip && !sprite.clips?.[layer.clip])
      problems.push(`clips to missing "${layer.clip}"`);
  for (const [name, point] of Object.entries(sprite.anchors ?? {}))
    if (point.x < 0 || point.x > w || point.y < 0 || point.y > h)
      problems.push(`anchor "${name}" is outside the drawing box`);
  return problems;
}

const wallView = kit.views['scene.wallView'];

/** Every scene the kit draws, the wall view's far and near bands included,
 * and whether the knight stands in it (the far band holds only raiders). */
const allScenes = (): [string, Scene, boolean][] => [
  ...scenes().map(([role, scene]): [string, Scene, boolean] => [
    role,
    scene,
    true,
  ]),
  ['scene.wallView:far', wallView.far, false],
  ['scene.wallView:near', wallView.near, true],
];

/** WCAG contrast between two hex colours. */
function contrast(a: string, b: string) {
  const channel = (hex: string, at: number) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) =>
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const allSprites = (): [string, Sprite][] => [
  ...Object.entries(kit.sprites),
  ...Array.from({ length: 8 }, (_, day): [string, Sprite] => [
    `reward.moon(${day})`,
    kit.families['reward.moon'](day),
  ]),
  ...rankTiers.flatMap((tier) =>
    [0, 1, 2, 3].map((level): [string, Sprite] => [
      `reward.rankEmblem.${tier}(${level})`,
      kit.emblems[`reward.rankEmblem.${tier}`](level),
    ]),
  ),
  ...Object.entries(kit.characters['map.castle'].states).map(
    ([state, sprite]): [string, Sprite] => [`map.castle:${state}`, sprite],
  ),
  ...Object.entries(kit.characters['character.knight'].states).map(
    ([state, sprite]): [string, Sprite] => [
      `character.knight:${state}`,
      sprite,
    ],
  ),
  ...raiderKinds.flatMap((kind) =>
    Object.entries(kit.characters[`character.raider.${kind}`].states).map(
      ([state, sprite]): [string, Sprite] => [
        `character.raider.${kind}:${state}`,
        sprite,
      ],
    ),
  ),
];

describe('the nightWatch kit', () => {
  it.each(allSprites())('%s is a complete sprite', (_role, sprite) => {
    expect(spriteProblems(sprite)).toEqual([]);
  });

  it('gives the knight every pose the Watch page asks for', () => {
    expect(
      Object.keys(kit.characters['character.knight'].states).sort(),
    ).toEqual([...knightStates].sort());
  });

  it('draws the wall in every Watch state', () => {
    expect(Object.keys(kit.scenes['scene.wallHero']).sort()).toEqual(
      [...wallStates].sort(),
    );
  });

  it('gives the knight the anchors the lantern light and the wall rely on', () => {
    for (const sprite of Object.values(
      kit.characters['character.knight'].states,
    )) {
      expect(sprite.anchors?.lantern).toBeDefined();
      expect(sprite.anchors?.feet).toBeDefined();
    }
  });

  it.each(raiderKinds)(
    'gives the %s raider every state and the anchors its crown and words sit on',
    (kind) => {
      const { states } = kit.characters[`character.raider.${kind}`];
      expect(Object.keys(states).sort()).toEqual([...raiderStates].sort());
      for (const sprite of Object.values(states)) {
        expect(sprite.anchors?.head).toBeDefined();
        expect(sprite.anchors?.crown).toBeDefined();
        expect(sprite.anchors?.feet).toBeDefined();
      }
      // Knocked over: it lies lower than it stands.
      expect(states.knockedOut.anchors?.crown?.y ?? 0).toBeGreaterThan(
        states.lurk.anchors?.crown?.y ?? 0,
      );
    },
  );

  it.each(rankTiers)(
    'draws a %s emblem with one pip per level and the anchors the rank-up beat uses',
    (tier) => {
      const emblem = kit.emblems[`reward.rankEmblem.${tier}`];
      const pips = (level: number) =>
        layersOf(emblem(level).layers).filter(
          (layer) =>
            layer.kind === undefined &&
            'd' in layer &&
            layer.fill === '#f2f1ec',
        ).length;
      for (const level of [0, 1, 2, 3]) {
        expect(pips(level)).toBe(level);
        expect(emblem(level).anchors?.centre).toBeDefined();
        expect(emblem(level).anchors?.base).toBeDefined();
      }
      // Each level is its own drawing, so the gallery and tests can tell them apart.
      expect(new Set([0, 1, 2, 3].map((l) => emblem(l).id)).size).toBe(4);
    },
  );

  it('raises a castle on the map for a reached rank and one ahead, flag and base anchored', () => {
    const { states } = kit.characters['map.castle'];
    expect(Object.keys(states).sort()).toEqual([...castleStates].sort());
    for (const sprite of Object.values(states)) {
      expect(sprite.anchors?.flag).toBeDefined();
      expect(sprite.anchors?.base).toBeDefined();
    }
  });

  it('finds the emblem for every rank the server names, and Page’s for one it does not know', () => {
    const ranks = [
      ['page', 'Page', 'page', 0],
      ['squire-1', 'Squire I', 'squire', 1],
      ['squire-2', 'Squire II', 'squire', 2],
      ['squire-3', 'Squire III', 'squire', 3],
      ['knight-1', 'Knight I', 'knight', 1],
      ['knight-2', 'Knight II', 'knight', 2],
      ['knight-3', 'Knight III', 'knight', 3],
    ] as const;
    for (const [key, name, tier, level] of ranks) {
      expect(rankEmblemOf({ key, name })).toEqual({ tier, level });
      expect(rankEmblemOf({ name })).toEqual({ tier, level });
    }
    // The ranks past Knight III wear the full knight's emblem until they have art.
    expect(
      rankEmblemOf({ key: 'warden-1', name: 'Warden of the March I' }),
    ).toEqual({ tier: 'knight', level: 3 });
    expect(rankEmblemOf({ key: 'castellan', name: 'Castellan' })).toEqual({
      tier: 'knight',
      level: 3,
    });
    expect(rankEmblemOf({ key: 'herald-1', name: 'Herald I' })).toEqual({
      tier: 'page',
      level: 1,
    });
  });

  it('sets the captain’s crown on its base', () => {
    expect(kit.sprites['character.raider.captain'].anchors?.base).toBeDefined();
  });

  it('clips the moon to its lit part only once a phase has light', () => {
    const lit = (day: number) =>
      layersOf(kit.families['reward.moon'](day).layers).filter(
        (layer) => layer.kind !== 'group' && layer.clip === 'lit',
      ).length;
    expect(lit(0)).toBe(0);
    expect(lit(3)).toBeGreaterThan(0);
    expect(lit(7)).toBe(lit(3));
  });

  describe.each(allScenes())('%s', (_role, scene: Scene, knight: boolean) => {
    const tiled = scene.items.filter((item) => item.kind === 'tiled');

    it('tiles every repeating layer at the scene size, so tiles join', () => {
      for (const item of tiled) {
        expect(item.sprite.viewBox).toEqual([scene.tile, scene.height]);
        expect(spriteProblems(item.sprite)).toEqual([]);
      }
    });

    it('moves the far layers slower than the near ones', () => {
      const speeds = tiled.map((item) => item.parallax);
      expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
      for (const speed of speeds) {
        expect(speed).toBeGreaterThanOrEqual(0);
        expect(speed).toBeLessThanOrEqual(1);
      }
    });

    it('draws every pinned sprite completely', () => {
      for (const item of scene.items)
        if (item.kind === 'fixed')
          expect(spriteProblems(item.sprite)).toEqual([]);
    });

    it('puts the knight behind the battlements and his light in front', () => {
      if (!knight) return;
      const order = scene.items.map((item) => item.id);
      expect(order.indexOf('knight')).toBeGreaterThanOrEqual(0);
      expect(order.indexOf('knight')).toBeLessThan(order.indexOf('wall'));
      expect(order.indexOf('knightLight')).toBeGreaterThan(
        order.indexOf('wall'),
      );
    });

    it('names each item once and keeps actors inside the frame height', () => {
      const ids = scene.items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of scene.items)
        if (item.kind === 'actor')
          expect(item.top + item.height).toBeLessThanOrEqual(scene.height + 40);
    });
  });

  it('shuts the gate and clears the treeline once the watch is kept', () => {
    const { before, kept } = kit.scenes['scene.wallHero'];
    const ids = (scene: Scene) => scene.items.map((item) => item.id);
    expect(ids(kept)).toContain('gate');
    expect(ids(before)).not.toContain('gate');
    const raiders = (scene: Scene) =>
      scene.items.flatMap((item) =>
        item.kind === 'tiled'
          ? layersOf(item.sprite.layers).filter(
              (layer) => layer.kind === 'text' && /[♝♞♜♛♟]/.test(layer.text),
            )
          : [],
      ).length;
    expect(raiders(before)).toBeGreaterThan(0);
    expect(raiders(kept)).toBe(0);
  });

  it('ends the watch over the shut gate, the raiders gone and the count centred over the gate at any width', () => {
    const { end } = kit.scenes['scene.wallHero'];
    const gate = end.items.find((item) => item.id === 'gate');
    const caption = end.items.find((item) => item.id === 'gateCaption');
    expect(gate?.kind).toBe('fixed');
    expect(caption?.kind).toBe('actor');
    if (gate?.kind !== 'fixed' || caption?.kind !== 'actor') return;
    // Both measured from the right edge, so they line up on any screen.
    const [w, h] = gate.sprite.viewBox;
    const gateCentre = gate.right + (gate.size * w) / h / 2;
    expect(caption.right).toBeDefined();
    expect((caption.right ?? 0) + caption.width / 2).toBeCloseTo(gateCentre);
    // Above the gate, below the moon.
    expect(caption.top + caption.height).toBeLessThanOrEqual(gate.top);
    const moon = end.items.find((item) => item.id === 'moon');
    if (moon?.kind === 'fixed')
      expect(caption.top).toBeGreaterThanOrEqual(moon.top + moon.size);
    expect(
      end.items.flatMap((item) =>
        item.kind === 'tiled'
          ? layersOf(item.sprite.layers).filter(
              (layer) => layer.kind === 'text' && /[♝♞♜♛♟]/.test(layer.text),
            )
          : [],
      ),
    ).toEqual([]);
  });
});

function keyframeProblems(keyframes: Recipe['keyframes'], end: Frame) {
  const problems: string[] = [];
  const ats = keyframes.map((key) => key.at);
  if (ats[0] !== 0) problems.push('does not start at 0');
  if (ats[ats.length - 1] !== 1) problems.push('does not end at 1');
  if (ats.some((at, i) => i > 0 && at < (ats[i - 1] ?? 0)))
    problems.push('keyframes are out of order');
  for (const [property, value] of Object.entries(end) as [
    keyof Frame,
    number,
  ][])
    if (Math.abs(frameAt(keyframes, property, 1, Number.NaN) - value) > 1e-9)
      problems.push(`its last frame is not its end frame (${property})`);
  return problems;
}

describe('the nightWatch recipes', () => {
  it.each(Object.entries(kit.recipes))(
    '%s is a complete recipe',
    (_role, recipe) => {
      expect(keyframeProblems(recipe.keyframes, recipe.end)).toEqual([]);
      if (recipe.night)
        expect(keyframeProblems(recipe.night, recipe.end)).toEqual([]);
    },
  );

  it.each(Object.entries(kit.recipes).filter(([, recipe]) => recipe.board))(
    '%s, over the board, ends within 600 ms',
    (_role, recipe) => {
      expect(recipe.duration).toBeGreaterThan(0);
      expect(recipe.duration).toBeLessThanOrEqual(600);
    },
  );

  it('lands a piece gently enough at night and settles it back to full size', () => {
    const land = kit.recipes['fx.land'];
    const deepest = (keys: Recipe['keyframes']) =>
      Math.min(...keys.map((key) => key.scale ?? 1));
    expect(land.night).toBeDefined();
    expect(deepest(land.night ?? [])).toBeGreaterThan(deepest(land.keyframes));
    for (const night of [false, true]) {
      const curve = landingCurve(land, night);
      expect(curve[0]).toEqual({ at: 0, scale: 1 });
      expect(curve[curve.length - 1]).toEqual({ at: land.duration, scale: 1 });
    }
  });

  it('grows the praise with the run, starting at the first clean answer', () => {
    const words = kit.copy.praise;
    expect(words[0]?.run).toBe(1);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]?.run).toBeGreaterThan(words[i - 1]?.run ?? 0);
      expect(words[i]?.scale).toBeGreaterThanOrEqual(words[i - 1]?.scale ?? 0);
    }
  });

  it.each(raidRecipes)(
    '%s plays in the scene only, briefly, with a calmer night version',
    (role) => {
      const recipe = kit.recipes[role];
      expect(recipe.board).toBe(false);
      expect(recipe.duration).toBeGreaterThan(0);
      // The scene reacts after the verdict and never holds up the next position.
      expect((recipe.delay ?? 0) + recipe.duration).toBeLessThanOrEqual(1200);
      expect(recipe.night).toBeDefined();
      const swing = (keys: Recipe['keyframes']) =>
        Math.max(...keys.map((key) => Math.abs((key.scale ?? 1) - 1)));
      expect(swing(recipe.night ?? [])).toBeLessThanOrEqual(
        swing(recipe.keyframes),
      );
    },
  );

  it('ends each raid reaction where the story leaves the raiders', () => {
    const end = (role: RaidRecipeRole) => kit.recipes[role].end;
    // Back into the trees and out of sight; forward and nearer; knocked out
    // and gone; the cracked segment emptied.
    expect(end('fx.raidersFallBack')).toMatchObject({ opacity: 0 });
    expect(end('fx.raidersFallBack').translateY).toBeGreaterThan(0);
    expect(end('fx.raidersEdgeIn').scale).toBeGreaterThan(1);
    expect(end('fx.raidersEdgeIn').opacity ?? 1).toBe(1);
    expect(end('fx.raiderOut')).toMatchObject({ opacity: 0 });
    expect(end('fx.raiderOut.word')).toMatchObject({ opacity: 0 });
    expect(end('fx.captainHit')).toMatchObject({ opacity: 0 });
    // Both reactions start from the raiders waiting, so each plays back to it.
    for (const role of ['fx.raidersFallBack', 'fx.raidersEdgeIn'] as const)
      for (const keys of [
        kit.recipes[role].keyframes,
        kit.recipes[role].night ?? [],
      ]) {
        expect(frameAt(keys, 'scale', 0, 1)).toBe(1);
        expect(frameAt(keys, 'translateY', 0, 0)).toBe(0);
        expect(frameAt(keys, 'opacity', 0, 1)).toBe(1);
      }
  });

  it.each(['fx.lanternBrighten', 'fx.turnedBack'] as const)(
    '%s plays at the session end only, briefly, ends shown, and cross-fades at night',
    (role) => {
      const recipe = kit.recipes[role];
      expect(recipe.board).toBe(false);
      expect(recipe.duration).toBeGreaterThan(0);
      expect(recipe.duration).toBeLessThanOrEqual(600);
      // Its last frame is what reduced motion shows: fully there, at rest.
      expect(recipe.end).toMatchObject({ opacity: 1, scale: 1 });
      // The night rule: no swelling or bouncing after 21:00, only a fade.
      for (const key of recipe.night ?? []) expect(key.scale ?? 1).toBe(1);
      expect(recipe.night).toBeDefined();
      expect(frameAt(recipe.night ?? [], 'opacity', 0, 1)).toBe(0);
    },
  );

  it('words the watch’s end', () => {
    const { one, many, coach } = kit.copy.watchEnd;
    for (const words of [one, many, coach]) expect(words).not.toBe('');
  });

  it('has a word for a knocked-out raider', () => {
    expect(kit.copy.raid.out).not.toBe('');
  });

  describe('scene.wallView', () => {
    it('hangs the fringe over the board by less than its own height', () => {
      const { fringe, near } = wallView;
      const [width, height] = fringe.sprite.viewBox;
      expect(width).toBe(near.tile);
      expect(fringe.overlap).toBeGreaterThan(0);
      expect(fringe.overlap).toBeLessThan(height);
      expect(spriteProblems(fringe.sprite)).toEqual([]);
    });

    it('keeps a slot at the treeline for the raiders', () => {
      expect(
        wallView.far.items.some(
          (item) => item.kind === 'actor' && item.id === 'raiders',
        ),
      ).toBe(true);
    });
  });

  it.each(Object.entries(kit.surfaces))(
    '%s keeps its words readable on its fill',
    (_role, surface) => {
      expect(contrast(surface.ink, surface.fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(surface.inkMuted, surface.fill)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );
});
