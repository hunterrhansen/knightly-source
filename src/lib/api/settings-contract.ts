import { z } from 'zod';
import { linkedAccountSchema } from './import-contract';
import { meSchema } from './response-schemas';

const count = z.number().int().nonnegative();
const practicePaceSchema = z.enum(['light', 'standard', 'intense']);
export type PracticePace = z.infer<typeof practicePaceSchema>;
const run = z.object({
  started_at: z.string(),
  finished_at: z.string().nullable(),
  status: z.string(),
  new_games: count.nullable(),
  games_analysed: count.nullable(),
  errors: z.array(z.string()),
});
export const settingsSchema = z.object({
  accounts: z.array(
    linkedAccountSchema.extend({ synced_through: z.string().nullable() }),
  ),
  running: z.boolean(),
  last_run: run.nullable(),
  earlier_runs: z.array(run),
  current_run: z
    .object({ started_at: z.string(), progress: z.unknown() })
    .nullable(),
  engine: z.string().nullable(),
  nodes: z.number().int().positive(),
  // A backend from before practice paces omits it; it serves Standard's amount.
  pace: practicePaceSchema.default('standard'),
  fsrs: z.object({
    personal: z.boolean(),
    reviews: count,
    needed: count,
    tuned_reviews: count.nullable(),
  }),
  your_data: z.object({
    games: count,
    analysed: count,
    first_game: z.string().nullable(),
    approx_bytes: count,
  }),
  limits: meSchema.shape.limits,
});
export type AccountSettings = z.infer<typeof settingsSchema>;
