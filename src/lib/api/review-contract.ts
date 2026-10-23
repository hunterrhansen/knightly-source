import { Chess } from 'chess.js';
import { z } from 'zod';
import { mistakeLayers, principles } from '../../chess/mistake-layers';
import { playUci } from '../../chess/move';
import type { components } from './schema';

const timestamp = z
  .string()
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    'Invalid review timestamp',
  );
const positive = z.number().int().positive();
const uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
const side = z.enum(['white', 'black']);
const fen = z.string().refine((value) => {
  try {
    new Chess(value);
    return true;
  } catch {
    return false;
  }
}, 'Invalid chess position');
const reviewMarkSchema = z.object({
  ply: positive,
  mark: z.enum(['found', 'good', 'helped', 'missed', 'praise', 'seen']),
});
export const gameDetailSchema = z.object({
  id: positive,
  white: z.string(),
  black: z.string(),
  color: side.nullable(),
  analysed: z.boolean(),
  start_fen: fen.nullable(),
  san: z.array(z.string()),
  reviewed_at: timestamp.nullable(),
  review_marks: z.array(reviewMarkSchema).max(200),
  accuracy: z.number().finite().nullable(),
  // Summary details; optional so older responses still parse.
  engine_accuracy: z.number().finite().nullable().optional(),
  opponent_accuracy: z.number().finite().nullable().optional(),
  /** The player's Chess.com avatar, when their profile has one; absent for
   * Lichess, PGN imports and older servers, where initials show instead. */
  user_avatar: z.string().nullable().optional(),
  opponent_avatar: z.string().nullable().optional(),
  white_elo: z.number().int().nullable().optional(),
  black_elo: z.number().int().nullable().optional(),
  outcome: z.string().nullable().optional(),
  time_control: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  deck_plies: z.array(positive),
  /** The game's review cards with where each is on the watch (backend
   * watch.deck_cards). Older servers omit it. */
  deck_cards: z
    .array(
      z.object({
        ply: positive,
        state: z.enum(['on_watch', 'held', 'stopped']),
        due: z.string().nullable(),
        label: z.string(),
        reason: z.string().nullable(),
        held: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  plies: z.array(
    z.object({
      ply: positive,
      color: side,
      san: z.string(),
      uci,
      classification: z.string().nullable(),
      best_san: z.string().nullable(),
      best_uci: uci.nullable(),
      win_pct_before: z.number().finite().nullable(),
      win_pct_after: z.number().finite().nullable(),
      // Engine evaluation after the move, for White: centipawns or mate in N.
      eval_after: z.number().finite().nullable().optional(),
      mate_after: z.number().int().nullable().optional(),
      clock_left: z.number().finite().nullable().optional(),
      // Which habit or skill a mistake of yours came from (layers.py).
      layer: z.enum(mistakeLayers).nullable().optional(),
      time_trouble: z.boolean().nullable().optional(),
      // Why you missed what the move allowed (causes.py); unreadable: none.
      cause: z
        .object({
          cause_kind: z.enum(['missedThreat', 'backRank', 'loosePiece']),
          cause_text: z.string().min(1).max(120),
          reply_uci: uci,
          reply_san: z.string().min(1).max(12),
        })
        .nullable()
        .optional()
        .catch(null),
      principle: z.enum(principles).nullable().optional().catch(null),
    }),
  ),
});
export const finishReviewSchema = z.object({ reviewed_at: timestamp });
const lineSchema = z
  .object({
    start_fen: fen,
    moves: z.array(uci).max(8),
    summary: z.string().nullable(),
  })
  .refine((line) => {
    try {
      const chess = new Chess(line.start_fen);
      for (const move of line.moves) playUci(chess, move);
      return true;
    } catch {
      return false;
    }
  }, 'Illegal engine line');
export const engineLinesSchema = z.object({
  best: lineSchema.optional(),
  why: lineSchema.optional(),
});
export type GameDetail = z.infer<typeof gameDetailSchema>;
export type ReviewMark = z.infer<typeof reviewMarkSchema>;
export type EngineLines = z.infer<typeof engineLinesSchema>;
/** Every move's lines from the game's stored analysis, by ply. A move whose lines
 * fail validation is left out, so the app asks for it alone instead. */
export const gameLinesSchema = z
  .record(z.string(), z.unknown())
  .transform((all) => {
    const out = new Map<number, EngineLines>();
    for (const [key, value] of Object.entries(all)) {
      const ply = Number(key);
      const lines = engineLinesSchema.safeParse(value);
      if (Number.isInteger(ply) && ply > 0 && lines.success)
        out.set(ply, lines.data);
    }
    return out as ReadonlyMap<number, EngineLines>;
  });
export type ReviewInput = components['schemas']['ReviewIn'];
