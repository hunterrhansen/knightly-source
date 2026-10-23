import { z } from 'zod';
import { journeySummarySchema } from './journey-contract';

const count = z.number().int().nonnegative();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)));
const progressStep = { done: z.boolean(), count, total: count };
const streakDay = z.object({
  date: day,
  state: z.enum([
    'done',
    'frozen',
    'rest',
    'missed',
    'none',
    'today',
    'upcoming',
  ]),
  /** A done day's night in its streak, 1-based (frozen days add none); null
   * otherwise. Older servers omit it. */
  night: count.nullish(),
});

/** The learner's watch: the local time they keep it and the habit it follows
 * ("After I finish dinner, I will keep my watch"). Saving restarts reminder back-off. */
export const watchSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/),
  anchor: z.string().min(2).max(60),
  set_on: day,
});
export type Watch = z.infer<typeof watchSchema>;

/** A move row on the Watch page's tonight card (backend watch.tonight): never
 * answered (`new`), answered wrong before (`again`) or one Good answer from
 * stopping slipping (`almost`). */
const tonightCardSchema = z.object({
  game_id: z.number().int().positive(),
  ply: z.number().int().positive(),
  san: z.string().min(1).max(10),
  label: z.string().min(1).max(40),
  opponent: z.string().nullable(),
  played_at: instant.nullable(),
  chip: z.enum(['new', 'again', 'almost']).nullable(),
  color: z.enum(['white', 'black']),
  /** The position before the move, for its small board. */
  fen: z.string().max(100).nullable(),
});
export type TonightCard = z.infer<typeof tonightCardSchema>;

/** `/api/home`'s `journey`: stars (moves that stopped slipping, all time) and
 * the rank they reached (backend watch.journey_summary). */
/** `/api/home`'s `today`: the daily review plan, streak and memory (backend daily.py). */
export const dailyReviewSchema = z.object({
  day,
  day_ends_at: instant,
  plan: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('game'), done: z.boolean() }),
        z.object({ kind: z.literal('positions'), ...progressStep }),
        z.object({ kind: z.literal('puzzles'), ...progressStep }),
      ]),
    )
    .max(3),
  streak: z.object({
    count,
    best: count,
    freezes: count,
    safe_today: z.boolean(),
    week: z.array(streakDay).length(7),
    /** The latest day that counted, or null; reminders back off from it. Older
     * servers omit it. */
    last_kept: day.nullish(),
    /** Every night kept, all time. Older servers omit it. */
    nights_total: count.optional(),
  }),
  /** The daily lesson: practice items answered today against its size (0: none). */
  lesson: z.object({ done: count, total: count }),
  memory: z.object({
    total: count,
    mastered: count,
    learning: count,
    new: count,
    /** Positions whose answer today took them into long-term memory. */
    mastered_today: count.optional(),
    /** Moves that stopped slipping today (held for 11+ days): the Watch
     * page's relit star. Older servers omit it. */
    stopped_today: count.optional(),
  }),
  /** New positions "Learn more" adds today once the queue is finished (0: none to offer).
   * A backend from before Learn more omits it. */
  learn_more: count.default(0),
  tomorrow_due: count,
  game: z
    .object({
      id: z.number().int().positive(),
      opponent: z.string().nullable(),
      speed: z.string().nullable(),
      outcome: z.string().nullable(),
      blunders: count.nullable(),
      mistakes: count.nullable(),
    })
    .nullable(),
  new_games: count,
  /** New games with moves that slipped past: the home's Games tile badge.
   * Older servers omit it. */
  new_games_slipped: count.optional(),
  /** Games analysed and still waiting, so an empty or small deck can say why. */
  games: z.object({ analyzed: count, pending: count }).optional(),
  /** The skill today's lesson leans toward, from the mistakes costing you most in
   * recent games (learning loop spec, part 2). Older servers omit it. */
  focus: z
    .object({
      key: z.enum(['safety', 'tactics', 'calculation']),
      cost: z.number().nonnegative(),
      window: count,
    })
    .nullish(),
  /** Null until the learner chooses; older servers omit it. */
  watch: watchSchema.nullish(),
  /** Tonight's lesson in brief: up to three of its moves in lesson order, the
   * new slips among them from the last week of games, and how many more items
   * it holds. Older servers omit it. */
  tonight: z
    .object({
      slipped_recent: count,
      cards: z.array(tonightCardSchema).max(3),
      remaining: count,
      /** The newly analysed game whose new slips lead tonight's lesson (the
       * rows are then its slips); null without one. Older servers omit it. */
      game: z
        .object({
          id: z.number().int().positive(),
          opponent: z.string().nullable(),
          played_at: instant.nullable(),
          slipped: count,
        })
        .nullish(),
    })
    .nullish(),
  /** Extra watches finished tonight (backend extra.py), for the path's small
   * nodes after the night. Older servers omit it. */
  extra_kept: count.optional(),
  puzzles: z.object({
    theme: z.string().nullable(),
    share: z.number().min(0).max(1).nullable(),
  }),
  /** Stars and rank, from the home response's `journey` (kept beside `today`
   * for the Watch page's kept results and a session's end). Older servers
   * omit it. */
  journey: journeySummarySchema.nullish(),
});
export type DailyReview = z.infer<typeof dailyReviewSchema>;
export type DailyReviewStep = DailyReview['plan'][number];
/** The HTTP response; the cache keeps the `today` part it yields. */
export const homeTodaySchema = z
  .object({
    today: dailyReviewSchema,
    journey: journeySummarySchema.nullish(),
  })
  .transform((home): DailyReview => ({ ...home.today, journey: home.journey }));

/** `/api/streak/days`: each day's streak state, as in `streak.week` (backend daily.py). */
export const streakDaysSchema = z.object({
  days: z.array(streakDay).max(42),
});
