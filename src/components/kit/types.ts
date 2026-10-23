// The watch kit's vocabulary (docs/specs/2026-10-18-watch-kit-design.md):
// sprites are layered vector art with named anchors, characters are sprites
// per state, and scenes stack tiled layers and actor slots. Screens ask the
// kit for a role; the manifest decides which art fills it.

type Point = Readonly<{ x: number; y: number }>;

/** Fill and stroke for one layer. Colours are art colours (hex). */
type Paint = Readonly<{
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  linecap?: 'round' | 'butt';
  linejoin?: 'round' | 'miter';
  /** A clip defined in the sprite's `clips`, by name. */
  clip?: string;
  transform?: string;
}>;

type Shape =
  | Readonly<{ kind?: 'path'; d: string }>
  | Readonly<{ kind: 'circle'; cx: number; cy: number; r: number }>
  | Readonly<{
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
    }>
  | Readonly<{
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
    }>
  | Readonly<{ kind: 'line'; x1: number; y1: number; x2: number; y2: number }>
  | Readonly<{
      kind: 'text';
      x: number;
      y: number;
      text: string;
      fontSize: number;
      anchor?: 'start' | 'middle' | 'end';
    }>;

export type Layer = Shape & Paint;

/** Layers drawn under one transform (a moon set in a medal). */
type Group = Readonly<{
  kind: 'group';
  transform: string;
  layers: readonly SpriteNode[];
}>;

export type SpriteNode = Layer | Group;

export type Sprite = Readonly<{
  /** Stable name for the gallery and tests, e.g. `knight.profile.lookout`. */
  id: string;
  /** The drawing box's width and height. */
  viewBox: readonly [number, number];
  layers: readonly SpriteNode[];
  /** Clip paths by name, for layers that set `clip`. */
  clips?: Readonly<Record<string, string>>;
  /** Named points in the drawing box that effects attach to. */
  anchors?: Readonly<Record<string, Point>>;
  /** Smallest and largest heights it ships at, in points. */
  sizes: Readonly<{ min: number; max: number }>;
}>;

/** The knight's poses the watch draws today; moods join as art arrives. */
export type KnightState = 'lookout' | 'dozing' | 'arriving';

/** The opponent's piece types, as chess.js names them. */
export type RaiderKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
/** A raider at the treeline: waiting, hit, knocked over, running back. */
export type RaiderState = 'lurk' | 'flinch' | 'knockedOut' | 'flee';
export type RaiderRole = `character.raider.${RaiderKind}`;

export type Character<State extends string> = Readonly<{
  id: string;
  states: Readonly<Record<State, Sprite>>;
}>;

/** A layer repeated sideways that moves with the camera times `parallax`. */
type TiledLayer = Readonly<{
  kind: 'tiled';
  id: string;
  sprite: Sprite;
  parallax: number;
}>;
/** A layer pinned to the frame (tonight's moon). */
type FixedLayer = Readonly<{
  kind: 'fixed';
  id: string;
  sprite: Sprite;
  size: number;
  top: number;
  right: number;
}>;
/** A slot the screen fills (the knight, his light), drawn at this depth. */
type ActorSlot = Readonly<
  {
    kind: 'actor';
    id: string;
    top: number;
    width: number;
    height: number;
  } & (
    | {
        /** Left edge as a share of the frame's width. */
        left: `${number}%`;
        right?: undefined;
      }
    | {
        /** Right edge in points from the frame's right, to line up with a
         * fixed layer (the caption over the gate). */
        right: number;
        left?: undefined;
      }
  )
>;

export type SceneItem = TiledLayer | FixedLayer | ActorSlot;

export type Scene = Readonly<{
  id: string;
  height: number;
  /** Width of one tile of every tiled layer. */
  tile: number;
  radius: number;
  /** The sky's gradient, top to bottom. */
  sky: readonly [string, string];
  /** Fills a frame taller than the art, below it; the sky's bottom colour
   * if unset (the wall's stone runs on under the lesson's buttons). */
  fill?: string;
  /** Back to front. */
  items: readonly SceneItem[];
}>;

/**
 * The lesson seen from the castle wall (`scene.wallView`): far at the top
 * behind the lesson's bars, the board as the field, near at the bottom.
 */
export type WallView = Readonly<{
  id: string;
  /** Sky, moon and the treeline, pinned to the bottom of the band behind the
   * bars; the sky's top colour fills any height above it. */
  far: Scene;
  /** The treeline's fringe, tiled along the board's top edge and hanging
   * `overlap` points over it. */
  fringe: Readonly<{ sprite: Sprite; overlap: number }>;
  /** The field beside and under the board. */
  ground: string;
  /** The battlements under the board, with the knight behind them
   * (`knight`) and his lantern's light in front (`knightLight`). */
  near: Scene;
  /** The lantern's light: a glow centred on the knight's `lantern` anchor. */
  light: Readonly<{ color: string; core: string; radius: number }>;
}>;

/** A themed surface the lesson's chrome is drawn on: the parchment bubble,
 * a stone button, a name plaque. */
export type Surface = Readonly<{
  fill: string;
  /** The ledge or drop shadow under it. */
  ledge: string;
  edge: string;
  ink: string;
  inkMuted: string;
}>;

export type SpriteRole =
  | 'reward.starShard'
  | 'reward.shootingStar'
  | 'reward.medal'
  /** The raid captain's crown, worn over a raider's `crown` anchor. */
  | 'character.raider.captain';
/** Sprites drawn from a number: the moon at a streak day. */
export type SpriteFamilyRole = 'reward.moon';
/** A rank's tier; its levels (Squire I–III) are pips on the tier's emblem.
 * The tiers past Knight are the Keep's, the March's and the Citadel's. */
export type RankTier =
  | 'page'
  | 'squire'
  | 'knight'
  | 'banneret'
  | 'captain'
  | 'warden'
  | 'castellan';
/** A rank's emblem, drawn for a level (0 for a rank without levels). */
type RankEmblemRole = `reward.rankEmblem.${RankTier}`;
/** A rank castle beside the map of nights: reached (flag up) or ahead. */
export type CastleState = 'reached' | 'ahead';
export type CharacterRole = 'character.knight';
export type SceneRole = 'scene.wallHero';
/** The Watch page's wall: before the watch, kept, and the first night;
 * `end` is the session end of the watch, over the shut gate. */
export type WallHeroState = 'before' | 'kept' | 'firstNight' | 'end';

/** One moment of a recipe: the values that are set at it. */
export type Frame = Readonly<{
  scale?: number;
  /** In board squares (cells) over the board, so it scales with the board;
   * in the actor's own heights in a scene (a raider sinking into the trees). */
  translateY?: number;
  opacity?: number;
  /** How much of its length a line has drawn, 0 to 1. */
  grow?: number;
}>;

/**
 * A named animation: keyframes over `duration`, each property linear between
 * the keyframes that set it. `end` is what reduced motion shows; `night`
 * replaces the keyframes after 21:00 (a calmer version).
 */
export type Recipe = Readonly<{
  id: string;
  duration: number;
  /** Starts this long after the beat fires. */
  delay?: number;
  /** Plays over the board: must end within 600 ms and never move squares.
   * Scene recipes (the raiders) play only around it. */
  board: boolean;
  easing: 'linear' | 'out';
  keyframes: readonly Readonly<{ at: number } & Frame>[];
  night?: readonly Readonly<{ at: number } & Frame>[];
  end: Frame;
}>;

export type BoardRecipeRole =
  | 'fx.land'
  | 'fx.capturePop.swell'
  | 'fx.capturePop.score'
  | 'fx.lineLight.beam'
  | 'fx.lineLight.glow'
  | 'fx.praise';
export type RaidRecipeRole =
  | 'fx.raidersFallBack'
  | 'fx.raidersEdgeIn'
  | 'fx.raiderOut'
  | 'fx.raiderOut.word'
  | 'fx.captainHit';
/** The end of the watch over the wall: the lantern brightening a step per
 * held move, then the raids turned back landing over the gate. */
export type SessionEndRecipeRole = 'fx.lanternBrighten' | 'fx.turnedBack';
export type RecipeRole =
  | BoardRecipeRole
  | RaidRecipeRole
  | SessionEndRecipeRole;

/** What the raiders at the treeline do after an answer: wait, fall back into
 * the trees (a right answer) or edge forward (a wrong one). */
export type RaidMood = 'lurk' | 'fallBack' | 'edgeIn';

/**
 * The opponent's pieces at the treeline, as the lesson describes them to the
 * wall view. A feature builds it from its position; the kit draws it.
 */
export type Raid = Readonly<{
  /** The position's identity: new raiders arrive when it changes. */
  key: string;
  raiders: readonly Readonly<{
    /** Stable through the position's moves (the square it started on). */
    id: string;
    kind: RaiderKind;
    /** Its board file as seen on screen, 0 at the left edge. */
    file: number;
    /** How near the wall it stands, 0 (their back rank) to 7. */
    depth: number;
    /** Captured by the learner: knocked out ("Out!"), then gone. */
    out: boolean;
  }>[];
  mood: RaidMood;
  /** The game's piece the plaque names when there is no captain: "kd_88's
   * bishop", the one whose move led to the position (never the threat's). */
  named?: string;
  /** On multi-move lines only: the piece that starts the threat, with one
   * segment per learner move of the line; right moves crack them. */
  captain?: Readonly<{
    id: string;
    /** Who it belongs to, for its plaque: "kd_88's bishop". */
    name: string;
    segments: number;
    cracked: number;
  }>;
}>;

/** A praise word, used from `run` clean answers in a row. */
export type Praise = Readonly<{ run: number; word: string; scale: number }>;
export type WallViewRole = 'scene.wallView';
export type SurfaceRole = 'ui.parchment' | 'ui.stoneButton' | 'ui.plaque';

export type Manifest = Readonly<{
  name: string;
  sprites: Readonly<Record<SpriteRole, Sprite>>;
  families: Readonly<Record<SpriteFamilyRole, (n: number) => Sprite>>;
  /** One emblem per rank tier, drawn at the rank's level. */
  emblems: Readonly<Record<RankEmblemRole, (level: number) => Sprite>>;
  characters: Readonly<
    {
      'character.knight': Character<KnightState>;
      'map.castle': Character<CastleState>;
    } & Record<RaiderRole, Character<RaiderState>>
  >;
  scenes: Readonly<{
    'scene.wallHero': Readonly<Record<WallHeroState, Scene>>;
  }>;
  /** Each ward-path post's landmark, by its curriculum key: the place that
   * rises behind the wall on its cards. A post without one shows the wall. */
  landmarks: Readonly<Record<string, Sprite>>;
  /** The distant skyline behind the hills in the Middle and Inner Wards. */
  skylines: Readonly<Record<'middle' | 'inner', Sprite>>;
  recipes: Readonly<Record<RecipeRole, Recipe>>;
  /** Story copy the beats show, tunable without touching screens. */
  copy: Readonly<{
    praise: readonly Praise[];
    /** The word over a knocked-out raider. */
    raid: Readonly<{ out: string }>;
    /** The words under the count over the gate at the watch's end. */
    watchEnd: Readonly<{ one: string; many: string; coach: string }>;
  }>;
  views: Readonly<Record<WallViewRole, WallView>>;
  surfaces: Readonly<Record<SurfaceRole, Surface>>;
}>;
