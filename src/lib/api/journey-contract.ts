import { z } from 'zod';

// Stars and ranks (backend watch.py; docs/specs/2026-10-18-watch-story-design.md,
// "Stars and ranks"). A star is a card's first stop: a move from your games held
// for 11+ days (watch.STOPPED_DAYS); the count never falls. Stars are not a route
// to rank: ranks come from the walk (a castle after every third post cleared), and
// a rank once reached is never lost.

const count = z.number().int().nonnegative();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** `/api/home`'s `journey`: the star count and the current and next rank. */
export const journeySummarySchema = z.object({
  stars: count,
  rank: z.string().min(1).max(40),
  rank_reached_on: day.nullable(),
  next_rank: z.string().min(1).max(40).nullable(),
  /** The post whose clearing reaches the next rank; null when no post does yet. */
  next_post: z.number().int().positive().nullable(),
});

const moveRow = z.object({
  game_id: z.number().int().positive(),
  ply: z.number().int().positive(),
  san: z.string().min(1).max(10),
  label: z.string().min(1).max(40),
  opponent: z.string().max(80).nullable(),
  color: z.enum(['white', 'black']),
  /** The position before the move, for its small board. */
  fen: z.string().max(100).nullable(),
});

/** A day of the schedule ahead (backend path.ahead): the moves due then by
 * their FSRS due dates, up to three by name. */
const aheadDaySchema = z.object({
  date: day,
  due: count,
  /** Moves whose Good answer that day would make them stop slipping. */
  last_checks: count,
  moves: z
    .array(
      moveRow.extend({
        /** Right answers in a row so far. */
        held: count,
        last_check: z.boolean(),
      }),
    )
    .max(3),
});

/** What a watch held: answers right and wrong, and moves that stopped
 * slipping. */
const heldSchema = z.object({
  date: day,
  held: count,
  slipped: count,
  stopped: count,
});

/** A post of the curriculum (backend wards.py; docs/specs/2026-10-20-curriculum-wards-design.md).
 * State is derived on every read: exactly one is `current`, and `blocked` is
 * one none of whose lessons can be taught yet (never cleared, never current). */
export const wardSchema = z.object({
  key: z.string().min(1).max(60),
  /** The plain topic ("The double attack"); the app's place copy leads. */
  name: z.string().min(1).max(80),
  index: z.number().int().positive(),
  state: z.enum(['cleared', 'current', 'ahead', 'blocked']),
  /** First entered and first cleared, from the server's forward-only record
   * of posts reached; absent from servers before it. */
  entered_on: day.nullable().optional(),
  cleared_on: day.nullable().optional(),
  lessons: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        name: z.string().min(1).max(80),
        track: z.string().min(1).max(30),
        /** The Steps Method's numbering: provenance only, never shown. */
        step: z.string().max(10),
        held: z.boolean(),
        /** Puzzles of its themes solved first try; three hold it. */
        solves: count,
        /** False while no drills exist for it: never held, never blocking. */
        teachable: z.boolean(),
      }),
    )
    .max(12),
});

/** `GET /api/journey`: the Progress map and the home path. `ahead`,
 * `history` and `first_star` are absent from servers before the path's
 * schedule (build step 3); the path then falls back to spreading nights
 * between known dates and leaves the nights ahead unlabelled. */
export const journeyMapSchema = journeySummarySchema.extend({
  /** Stars whose card has slipped again since. */
  dimmed: count,
  /** Every rank, lowest first, with the post that reaches it and the day reached. */
  ranks: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        name: z.string().min(1).max(40),
        /** Null for Page (the first night) and the Keep (no post reaches it yet). */
        post: z.number().int().positive().nullable(),
        reached_on: day.nullable(),
      }),
    )
    .min(1)
    .max(30),
  /** Every star, oldest first. A dimmed one stays counted. */
  star_list: z.array(
    z.object({
      game_id: z.number().int().positive(),
      ply: z.number().int().positive(),
      san: z.string().min(1).max(10),
      label: z.string().min(1).max(40),
      earned_on: day,
      dimmed: z.boolean(),
    }),
  ),
  nights: z.object({
    total: count,
    milestones: z
      .array(z.object({ nights: count, reached_on: day.nullable() }))
      .max(20),
  }),
  /** The next seven days, tomorrow first. */
  ahead: z.array(aheadDaySchema).max(14).optional(),
  history: z
    .object({
      /** Every kept night, oldest first: the Nth is night N. */
      nights: z.array(heldSchema),
      /** Every finished extra watch, oldest first. */
      extra: z.array(heldSchema),
    })
    .optional(),
  /** Before any star: the held move closest to the 11-day bar. */
  first_star: z
    .object({
      game_id: z.number().int().positive(),
      ply: z.number().int().positive(),
      san: z.string().min(1).max(10),
      label: z.string().min(1).max(40),
      /** Days it is expected to hold (FSRS stability), at most `target`. */
      days: z.number().nonnegative(),
      target: z.number().int().positive(),
      /** It also needs a puzzle of its tactic solved. */
      needs_family: z.boolean(),
    })
    .nullable()
    .optional(),
  /** Every move in the deck by where it is on the watch: Progress's "Your
   * moves". Older servers omit it. */
  moves: z.object({ on_watch: count, held: count, stopped: count }).optional(),
  /** The curriculum in order: the path's posts. Older servers omit it. */
  wards: z.array(wardSchema).max(60).optional(),
});
export type JourneyMap = z.infer<typeof journeyMapSchema>;
export type AheadDay = NonNullable<JourneyMap['ahead']>[number];
export type FirstStar = NonNullable<JourneyMap['first_star']>;
export type WatchMoves = NonNullable<JourneyMap['moves']>;
export type JourneyWard = NonNullable<JourneyMap['wards']>[number];
export type JourneyLesson = JourneyWard['lessons'][number];

/** `GET /api/journey/night?date=`: a kept night's watch, its moves and where
 * each stands now. */
export const keptNightSchema = heldSchema.extend({
  night: z.number().int().positive(),
  moves: z.array(
    moveRow.extend({
      held_then: z.boolean(),
      state: z.enum(['on_watch', 'held', 'stopped', 'hidden']),
      due: day.nullable(),
    }),
  ),
});
export type KeptNight = z.infer<typeof keptNightSchema>;
export type JourneyRank = JourneyMap['ranks'][number];
export type JourneyStar = JourneyMap['star_list'][number];
