import { z } from 'zod';

const progressRangeSchema = z.enum(['30d', '90d', 'all']);
export type ProgressRange = z.infer<typeof progressRangeSchema>;
const count = z.number().int().nonnegative();
const metric = z.number().finite().nullable();
const fraction = z.number().min(0).max(1).nullable();
const timingMetric = z.object({
  numerator: count,
  decisions: count,
  games: count,
  rate: fraction,
  reason: z.literal('insufficient_sample').nullable(),
  examples: z.array(
    z.object({
      game_id: z.number().int().positive(),
      ply: z.number().int().positive(),
      san: z.string(),
      seconds: z.number().nonnegative(),
      starting_clock: z.number().nonnegative(),
    }),
  ),
});
const timingSchema = z.object({
  policy: z.literal('10+0-descriptive-v1'),
  control: z.literal('600+0'),
  analysis_versions: z.array(z.string()),
  analysed_games: count,
  timed_decisions: count,
  excluded_decisions: count,
  pressure: timingMetric,
  fast: timingMetric,
  long: timingMetric,
  timeouts: z.object({
    losses: count,
    games: count,
    examples: z.array(z.number().int().positive()),
  }),
});
const kpisSchema = z.object({
  blunders_per_game: z.number().nonnegative().nullable(),
  conversion: fraction,
  punish_rate: fraction,
  comeback_rate: fraction,
  accuracy: z.number().min(0).max(100).nullable(),
  opening_edge: metric,
  analysed: count,
});
// Mean accuracy of your moves in one game phase, with the sample behind it;
// null when no eligible games reached the phase (or, for the previous period,
// fewer than ten did).
const phaseSchema = z.object({
  accuracy: z.number().min(0).max(100).nullable(),
  moves: count,
  games: count,
});
const phasesSchema = z.object({
  opening: phaseSchema,
  middlegame: phaseSchema,
  endgame: phaseSchema,
});
const skillAxisKeys = [
  'safety',
  'tactics',
  'calculation',
  'converting',
  'defending',
] as const;
export type SkillAxisKey = (typeof skillAxisKeys)[number];
const skillSample = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  reason: z.enum(['few_games', 'few_chances']).nullable(),
  successes: count,
  attempts: count,
  games: count,
  excluded: count,
});
// The Progress skill shape (spec "Skill shape scores"): five rates in a fixed
// order, null with counts below each minimum. Older servers omit it.
const skillShapeSchema = z.object({
  version: z.number().int().positive(),
  axes: z
    .array(
      skillSample.extend({
        key: z.enum(skillAxisKeys),
        previous: skillSample.nullable(),
      }),
    )
    .refine(
      (axes) =>
        axes.length === skillAxisKeys.length &&
        axes.every((axis, index) => axis.key === skillAxisKeys[index]),
      'Skill axes out of order',
    ),
});
const trendSkillKeys = ['safety', 'tactics', 'calculation'] as const;
export type TrendSkillKey = (typeof trendSkillKeys)[number];
// Each skill's mistakes in your recent games against the games before, with
// the practice in between (learning loop spec, part 1). Ignores the range;
// older servers omit it.
const gameTrendSchema = z
  .object({
    version: z.number().int().positive(),
    window: count,
    games: count,
    reason: z.literal('few_games').nullable(),
    since: z.string().nullable(),
    skills: z
      .array(
        z.object({
          key: z.enum(trendSkillKeys),
          recent: count,
          earlier: count,
          cost: z.number().nonnegative().nullable(),
          change: z.enum(['fewer', 'same', 'more']).nullable(),
          practice: z.object({ recent: count, earlier: count }),
        }),
      )
      .refine(
        (skills) =>
          skills.length === trendSkillKeys.length &&
          skills.every((skill, index) => skill.key === trendSkillKeys[index]),
        'Trend skills out of order',
      ),
  })
  .refine(
    (trend) => (trend.reason == null) === trend.window > 0,
    'A trend needs a window unless it has a reason',
  );
export type GameTrend = z.infer<typeof gameTrendSchema>;
export const overviewSchema = z.object({
  skill_shape: skillShapeSchema.nullish(),
  game_trend: gameTrendSchema.nullish(),
  range: progressRangeSchema,
  // Optional while the retained backend is deployed independently of the app.
  time_management: timingSchema.optional(),
  rating: z.object({ current: metric, change: metric, best: metric }),
  games_played: count,
  games_per_week: z.number().nonnegative(),
  games_analysed: count,
  rating_series: z.array(
    z.object({
      id: z.number().int().positive(),
      played_at: z
        .string()
        .refine(
          (value) => Number.isFinite(Date.parse(value)),
          'Invalid game date',
        ),
      rating: z.number().nonnegative(),
      opponent: z.string().nullable(),
      outcome: z.string().nullable(),
    }),
  ),
  kpis: kpisSchema,
  previous_kpis: kpisSchema.nullable(),
  // Optional while the backend is deployed independently of the app.
  phase_accuracy: z
    .object({ current: phasesSchema, previous: phasesSchema.nullable() })
    .optional(),
  // Mistakes in the period by layer (layers.py). Optional while the backend
  // is deployed independently of the app.
  layers: z
    .object({
      theirThreat: count,
      theirReply: count,
      calculation: count,
      ownTactic: count,
      other: count,
      pending: count,
    })
    .optional(),
  top_openings: z.array(
    z.object({
      eco: z.string().nullable(),
      opening: z.string().nullable(),
      color: z.enum(['white', 'black']),
      games: count,
      win_rate: z.number().min(0).max(1),
    }),
  ),
});
const firstTries = z
  .object({ attempts: count, first_try: count })
  .refine((t) => t.first_try <= t.attempts, 'More first tries than attempts');
export const patternsSchema = z.object({
  range: progressRangeSchema,
  pending: count,
  // First tries in practice per tactic, this period and the one before (null
  // for all time). Optional while the backend is deployed independently.
  strength: z
    .array(
      z.object({
        pattern: z.string(),
        attempts: count,
        first_try: count,
        previous: firstTries.nullable(),
      }),
    )
    .optional(),
  // Whether reviewing works: the next week's due reviews, the last 30 days'
  // reviews found without a miss, and tuning. Whatever the range; optional
  // while the backend is deployed independently.
  deck_health: z
    .object({
      forecast: z.array(z.object({ date: z.string(), due: count })).length(7),
      retention: z
        .object({
          rate: z.number().min(0).max(1),
          answers: count,
          target: z.number().min(0).max(1),
        })
        .nullable(),
      tuned: z.boolean(),
      /** Critical "Your move" positions found; null under 20 answers. */
      noticing: z
        .object({ rate: z.number().min(0).max(1), answers: count })
        .nullable()
        .optional(),
    })
    .optional(),
  // The review deck now, whatever the range, per tactic. Optional like
  // `strength`.
  memory: z
    .array(
      z
        .object({
          pattern: z.string(),
          total: count,
          mastered: count,
          learning: count,
          new: count,
        })
        .refine(
          (p) => p.mastered + p.learning + p.new === p.total,
          'Memory parts do not add up',
        ),
    )
    .optional(),
  patterns: z.array(
    z.object({
      pattern: z.string(),
      total: count,
      blunder: count,
      mistake: count,
      miss: count,
    }),
  ),
});
export const gameFiltersSchema = z.object({
  range: progressRangeSchema.optional(),
  kpi: z.enum(['blunders', 'thrown', 'unpunished', 'comebacks']).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  color: z.enum(['white', 'black']).optional(),
  speed: z.enum(['bullet', 'blitz', 'rapid', 'daily', 'classical']).optional(),
  result: z.enum(['win', 'loss', 'draw']).optional(),
  review_status: z.enum(['to_review', 'reviewed']).optional(),
  /** The Games scope: games where moves slipped past you, or clean ones. */
  slips: z.enum(['slipped', 'clean']).optional(),
  rated: z.enum(['all', 'rated']).optional(),
});
export type GameFilters = z.infer<typeof gameFiltersSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type Patterns = z.infer<typeof patternsSchema>;
