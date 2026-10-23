import { z } from 'zod';
import type { paths } from './schema';

const count = z.number().int().nonnegative();
export const linkedAccountSchema = z.object({
  source: z.string(),
  handle: z.string().min(1),
});
export const lookupSchema = linkedAccountSchema.extend({
  rating: count.nullable(),
  rating_kind: z.string().nullable(),
  games: count,
  since: z.string().nullable(),
}) satisfies z.ZodType<
  paths['/api/lookup']['get']['responses'][200]['content']['application/json']
>;
export const onboardingSchema = z.object({
  accounts: z.array(linkedAccountSchema),
  games: count,
  analysed: count,
  target: count,
  working: z.boolean(),
  step: z.string().nullable(),
  summary: z.object({
    blunders: count,
    mistakes: count,
    misses: count,
    positions: count,
    pattern: z.string().nullable(),
  }),
  findings: z.array(
    z.object({
      opponent: z.string().nullable(),
      played_at: z.string().nullable(),
      move_number: z.number().int(),
      color: z.string(),
      san: z.string(),
      best_san: z.string(),
      classification: z.string(),
    }),
  ),
}) satisfies z.ZodType<
  paths['/api/onboarding']['get']['responses'][200]['content']['application/json']
>;
export const statusSchema = z.object({
  queued: z.array(z.string()),
  current_run: z
    .object({ started_at: z.string(), progress: z.unknown() })
    .nullable(),
  last_run: z
    .object({
      status: z.string(),
      errors: z.array(z.string()),
      // Older fixtures and backends send only status and errors.
      started_at: z.string().optional(),
      finished_at: z.string().nullable().optional(),
      new_games: count.nullable().optional(),
      games_analysed: count.nullable().optional(),
    })
    .nullable(),
});
/** A game's slipped moves by where they are on the watch (backend watch.py). */
const slipsSchema = z.object({
  on_watch: count,
  held: count,
  stopped: count,
});
const gameSummarySchema = z.object({
  id: z.number().int().positive(),
  opponent: z.string().nullable(),
  played_at: z.string().nullable(),
  speed: z.string().nullable(),
  outcome: z.string().nullable(),
  analysed: z.boolean(),
  // Older persisted snapshots have only the original six fields.
  color: z.enum(['white', 'black']).nullable().optional(),
  opponent_rating: count.nullable().optional(),
  /** The opponent's Chess.com avatar; absent for Lichess, PGN imports and older
   * servers, where the row shows their initials instead. */
  opponent_avatar: z
    .string()
    .refine((value) => /^https:\/\//.test(value), 'Insecure avatar URL')
    .nullable()
    .optional(),
  opening: z.string().nullable().optional(),
  eco: z.string().nullable().optional(),
  time_control: z.string().nullable().optional(),
  accuracy: z.number().finite().min(0).max(100).nullable().optional(),
  reviewed_at: z
    .string()
    .refine(
      (value) => Number.isFinite(Date.parse(value)),
      'Invalid review date',
    )
    .nullable()
    .optional(),
  /** Null until analysed; all zero when nothing slipped. Older servers omit it. */
  slips: slipsSchema.nullish(),
});
export const gamesSchema = z.object({
  total: count,
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  games: z.array(gameSummarySchema),
  review_counts: z
    .object({ all: count, to_review: count, reviewed: count })
    .optional(),
  next_review: gameSummarySchema.nullable().optional(),
  /** The last seven days for the summary card. Older servers omit it. */
  week: slipsSchema
    .extend({ games: count, analysed: count, slipped: count })
    .optional(),
});
export const gamesPagesSchema = z
  .object({
    pages: z.array(gamesSchema).min(1),
    pageParams: z.array(z.number().int().positive()).min(1),
  })
  .refine(
    (value) =>
      value.pages.length === value.pageParams.length &&
      value.pages.every((page, index) => page.page === value.pageParams[index]),
    'Invalid game pages',
  );
export type GameSummary = z.infer<typeof gameSummarySchema>;
export type GamesPage = z.infer<typeof gamesSchema>;
export const updateSchema = z.object({
  started: z.boolean(),
  queued: z.boolean(),
});
export type Onboarding = z.infer<typeof onboardingSchema>;
export type ImportStatus = z.infer<typeof statusSchema>;
