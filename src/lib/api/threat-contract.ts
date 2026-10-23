import { Chess } from 'chess.js';
import { z } from 'zod';
import { passedFen, playUci } from '../../chess/move';

const positive = z.number().int().positive();
const uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
const fen = z.string().refine((value) => {
  try {
    new Chess(value);
    return true;
  } catch {
    return false;
  }
}, 'Invalid chess position');
export const legalFrom = (position: string, move: string) => {
  try {
    playUci(new Chess(position), move);
    return true;
  } catch {
    return false;
  }
};
export const threatSchema = z.object({
  uci,
  san: z.string(),
  line: z.array(uci),
  net: z.number().int(),
  mate: z.number().int().nullable(),
});
const qualitySchema = z.enum(['best', 'excellent', 'good', 'wrong']);
/** Where a question is answered from, by kind: the opponent moving as if you
 * passed (`threat`, `calm`), their reply after your own move (`allows`), or
 * your own move (`vision`). */
export function askedFen(item: { kind: string; fen_before: string }): string {
  return item.kind === 'allows' || item.kind === 'vision'
    ? item.fen_before
    : passedFen(item.fen_before);
}
/** A threat question asked on its own in daily practice (backend drill.py):
 * - `threat`: right after the opponent's move, what do they threaten?
 * - `calm`: the same question where nothing is threatened.
 * - `allows`: right after your own move, what did it allow them?
 * - `vision`: your own turn, they left a piece loose: take it. */
export const threatItemSchema = z
  .object({
    game_id: positive,
    ply: positive,
    kind: z.enum(['threat', 'calm', 'allows', 'vision']),
    color: z.enum(['white', 'black']),
    fen_before: fen,
    prev_uci: uci.nullable(),
    fen_prev: fen.nullable(),
    threats: z.array(threatSchema),
    opponent: z.string().nullable(),
    played_at: z.string().nullable(),
    played_san: z.string(),
    best_san: z.string().nullable(),
    // For threat items: the card's grade for each of your moves afterwards.
    grades: z.record(uci, qualitySchema).nullable(),
  })
  .refine((item) => {
    const board = new Chess(item.fen_before);
    // After your own move it is their turn; otherwise yours, and not in check.
    return item.kind === 'allows'
      ? board.turn() !== item.color[0]
      : board.turn() === item.color[0] && !board.inCheck();
  }, 'Wrong side to move for the kind')
  .refine(
    (item) => (item.kind === 'calm') === (item.threats.length === 0),
    'Calm items have no threats; every other kind has some',
  )
  .refine(
    (item) => item.threats.every((t) => legalFrom(askedFen(item), t.uci)),
    'Illegal threat',
  )
  .refine(
    (item) =>
      Object.keys(item.grades ?? {}).every((move) =>
        legalFrom(item.fen_before, move),
      ),
    'Illegal graded move',
  );
export const threatAnswerSchema = z.object({
  correct: z.boolean(),
  threats: z.array(threatSchema),
  rating: z.enum(['again', 'hard', 'good', 'easy']).nullable(),
  due: z.iso.date().nullable(),
});
export type ThreatItem = z.infer<typeof threatItemSchema>;
type Threat = z.infer<typeof threatSchema>;
/** Words for what a threat does: "dxc3 wins a piece", "Qh7 is mate". */
export function threatText(threat: Threat): string {
  if (threat.mate === 1 || threat.san.endsWith('#'))
    return `${threat.san} is mate`;
  if (threat.mate) return `${threat.san} leads to mate in ${threat.mate}`;
  return threat.net >= 9
    ? `${threat.san} wins the queen`
    : threat.net >= 5
      ? `${threat.san} wins a rook`
      : threat.net >= 3
        ? `${threat.san} wins a piece`
        : `${threat.san} wins material`;
}
export type ThreatAnswer = z.infer<typeof threatAnswerSchema>;
