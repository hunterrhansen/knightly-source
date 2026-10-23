import { Chess } from 'chess.js';
import { z } from 'zod';
import { principles } from '../../chess/mistake-layers';
import { moveFromUci, passedFen, playUci } from '../../chess/move';
import { wardSchema } from './journey-contract';
import type { components } from './schema';
import { legalFrom, threatItemSchema, threatSchema } from './threat-contract';

const count = z.number().int().nonnegative();
const uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
const day = z.iso.date();
const fen = z.string().refine((value) => {
  try {
    new Chess(value);
    return true;
  } catch {
    return false;
  }
}, 'Invalid chess position');
const lineKey = z.string().regex(/^[0-9a-f]{16}$/);
const color = z.enum(['white', 'black']);
const sideToMove = (fen: string, side: 'white' | 'black') => {
  try {
    return new Chess(fen).turn() === (side === 'white' ? 'w' : 'b');
  } catch {
    return false;
  }
};
/** Whether `uci` is legal from `from` and leads to `to` (same placement). */
const leadsTo = (from: string, uci: string, to: string) => {
  try {
    const board = new Chess(from);
    playUci(board, uci);
    return board.fen().split(' ')[0] === to.split(' ')[0];
  } catch {
    return false;
  }
};
/** The habit a mistake points to; the app owns each key's label. */
const principleSchema = z.enum(principles);
/** Why the learner missed what the move allows (blunder causes spec). */
const causeSchema = z.object({
  cause_kind: z.enum(['missedThreat', 'backRank', 'loosePiece']),
  cause_text: z.string().min(1).max(120),
  principle: principleSchema,
});
/** Coaching for a wrong first move: the punishing reply and why it hurts. */
const explanationSchema = z.object({
  reply_uci: uci,
  reply_san: z.string().min(1).max(12),
  reason_kind: z.enum([
    'mate',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'hangingPiece',
    'material',
    'missed',
    'eval',
  ]),
  reason_text: z.string().min(1).max(120),
  cause: causeSchema.optional().catch(undefined),
  principle: principleSchema.optional().catch(undefined),
});
/** Why the solution works, in one line. */
const whySchema = z.object({
  why_kind: z.enum([
    'mate',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'hangingPiece',
    'material',
  ]),
  why_text: z.string().min(1).max(120),
});
/** Explanations, keeping only well-formed entries: coaching never breaks grading. */
const explanationsSchema = z
  .record(z.string(), z.unknown())
  .transform((entries) => {
    const kept: Record<string, z.infer<typeof explanationSchema>> = {};
    for (const [move, value] of Object.entries(entries)) {
      const parsed = explanationSchema.safeParse(value);
      if (uci.safeParse(move).success && parsed.success)
        kept[move] = parsed.data;
    }
    return kept;
  });
/** One of the top moves, with a reason (blunder causes spec). */
const candidateSchema = z.object({
  uci,
  san: z.string().min(1).max(12),
  line: z.array(uci).min(1).max(12),
  score_cp: z.number().int(),
  mate: z.number().int().nullable(),
  reason_kind: z.string(),
  reason_text: z.string().min(1).max(120),
  about_equal: z.boolean(),
});
/** Candidates, keeping only well-formed entries; never fewer than two. */
const candidatesSchema = z
  .array(z.unknown())
  .max(3)
  .transform((entries) =>
    entries.flatMap((value) => {
      const parsed = candidateSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    }),
  );
/** The coaching shared by cards and puzzles; unreadable parts are dropped. */
const coachingFields = {
  explanations: explanationsSchema.optional().catch(undefined),
  why: whySchema.nullable().optional().catch(undefined),
  candidates: candidatesSchema.nullable().optional().catch(undefined),
};
/** Candidates whose line replays from `fen` with the SAN they name, best
 * first; "about equal" only on the second and third. Fewer than two: none. */
export function legalCandidates(
  fen: string,
  candidates: readonly Candidate[] | null | undefined,
): Candidate[] {
  const kept = (candidates ?? []).filter((candidate, index) => {
    if (index === 0 && candidate.about_equal) return false;
    if (candidate.line[0] !== candidate.uci) return false;
    try {
      const board = new Chess(fen);
      let first = '';
      for (const move of candidate.line) {
        const played = playUci(board, move);
        first ||= played.san;
      }
      return first === candidate.san;
    } catch {
      return false;
    }
  });
  return kept.length >= 2 && kept[0] === candidates?.[0] ? kept : [];
}
/** Drops an explanation whose wrong move or reply isn't legal from `fen`, or
 * whose SAN doesn't name its reply: it would describe another position. */
export function legalExplanations(
  fen: string,
  explanations: Record<string, z.infer<typeof explanationSchema>> | undefined,
) {
  const kept: Record<string, z.infer<typeof explanationSchema>> = {};
  for (const [move, explanation] of Object.entries(explanations ?? {})) {
    try {
      const board = new Chess(fen);
      playUci(board, move);
      const played = playUci(board, explanation.reply_uci);
      if (played.san === explanation.reply_san) kept[move] = explanation;
    } catch {
      // Illegal here: not shown.
    }
  }
  return kept;
}
const puzzleSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9]{1,16}$/),
    fen_prev: fen,
    prev_uci: uci,
    fen_before: fen,
    color,
    themes: z.array(z.string()),
    rating: z.number().int(),
    line_key: lineKey,
    /** The solution from `fen_before`, for instant answers; the server re-grades. */
    line: z.array(uci).min(1).max(40).optional(),
    /** Coaching the worker prepared for this puzzle, or null until it has. */
    feedback: z.object(coachingFields).nullable().optional().catch(null),
    /**
     * The review position this puzzle carries the same tactic as, when it was served as that
     * card's family. Absent for an ordinary session puzzle.
     */
    family: z
      .object({ game_id: z.number().int(), ply: z.number().int() })
      .nullable()
      .optional()
      .catch(null),
  })
  .refine(
    (p) =>
      sideToMove(p.fen_before, p.color) &&
      leadsTo(p.fen_prev, p.prev_uci, p.fen_before),
    'Inconsistent puzzle',
  );
/** A card's prepared map: grades for its first moves, and the coaching. */
const cardFeedbackSchema = z.object({
  grades: z.record(z.string(), z.enum(['best', 'excellent', 'good', 'wrong'])),
  complete: z.boolean(),
  ...coachingFields,
});
/** `GET /api/deck/feedback/{game_id}/{ply}`: the map, or null until prepared.
 * An unreadable map reads as none: the find works without it. */
export const cardFeedbackResponseSchema = z.object({
  feedback: cardFeedbackSchema.nullable().catch(null),
});
const nextReviewSchema = z.object({ due: day, mastered: z.boolean() });
const cardSchema = z
  .object({
    game_id: z.number().int().positive(),
    ply: z.number().int().positive(),
    reviews: count,
    /** Times its first answer of a day was a miss; older servers omit it. */
    lapses: count.optional(),
    /** Missed so often it opens with what to look at first (deck spec part 4). */
    leech: z.boolean().optional(),
    /** A "Your move" position (learning loop part 4), not a deck card: no
     * sign before the answer of whether anything is there. Answered at
     * `/api/unannounced/answer`, logged and never scheduled. */
    unannounced: z.enum(['critical', 'calm']).optional(),
    fen_before: fen,
    color,
    san: z.string().min(1),
    uci,
    move_number: z.number().int().positive(),
    classification: z.string(),
    opponent: z.string().nullable(),
    /** The player's Chess.com avatar, when their profile has one; absent for
     * Lichess, PGN imports and older servers, where initials show instead. */
    opponent_avatar: z.string().nullable().optional(),
    /** When its game was played; older servers omit it. */
    played_at: z.string().nullable().optional(),
    // The opponent's move that led here, and the position before it, so the
    // board can play it in. Absent for a game's first move.
    prev_uci: uci.nullable().optional(),
    fen_prev: fen.nullable().optional(),
    /** The tactic behind the mistake, when the backend has named one. */
    pattern: z.string().nullable().optional(),
    /** The solution line this position is served with; answers name it. */
    line_key: lineKey,
    /** That line itself (learner moves at even indexes), for instant answers. */
    line: z.array(uci).min(1).max(40).optional(),
    /** The worker's grade for each legal first move; `complete` when it has all. */
    feedback: cardFeedbackSchema.nullable().optional(),
    /** "What do they threaten?" first, when this move ignored a threat. */
    threat: z
      .object({ threats: z.array(threatSchema).min(1) })
      .nullable()
      .optional(),
    /** When it comes back for each grade if answered now, and whether that
     * grade makes it long-term; older servers send neither. */
    next: z
      .object({
        again: nextReviewSchema,
        hard: nextReviewSchema,
        good: nextReviewSchema,
        easy: nextReviewSchema,
      })
      .optional()
      .catch(undefined),
    /** Whether it is long-term already. */
    mastered: z.boolean().optional().catch(undefined),
  })
  .refine(
    (card) => sideToMove(card.fen_before, card.color),
    'Wrong side to move',
  )
  .refine(
    (card) =>
      !card.threat ||
      card.threat.threats.every((t) =>
        legalFrom(passedFen(card.fen_before), t.uci),
      ),
    'Illegal threat',
  );
export const deckSchema = z.object({
  /** What kind of practice this serving is (backend routes/practice.py): `taught`
   * a puzzle of the current post's idea, `volume` more of an idea already met,
   * `defend` a threat question, `unannounced` "Your move", `review` a puzzle
   * of an earlier post's idea, unannounced, for mixed review. Null for a review
   * card; older servers omit it. */
  mode: z
    .enum(['taught', 'volume', 'defend', 'unannounced', 'review'])
    .nullable()
    .optional()
    .catch(null),
  /** The ward tonight's new material comes from; older servers omit it. */
  ward: wardSchema.nullable().optional().catch(null),
  kinds: z
    .object({
      blunder: z.number().int().nonnegative(),
      miss: z.number().int().nonnegative(),
      mistake: z.number().int().nonnegative(),
    })
    .optional(),
  server_day: day,
  total: count,
  mastered: count,
  learning: count,
  new: count,
  /** Positions hidden with "Don't show this again"; older servers omit it. */
  suspended: count.optional(),
  today: z.object({ done: count, total: count }),
  /** The daily lesson's progress (backend daily.lesson). */
  lesson: z.object({ done: count, total: count }).optional(),
  card: cardSchema.nullable(),
  /** A threat question asked on its own, between positions. */
  threat_item: threatItemSchema.nullable().optional(),
  /** "Your move": a position from your games with no prompt beyond that. */
  unannounced_item: cardSchema.nullable().optional(),
  /** A Lichess puzzle, served once today's own cards are done. */
  puzzle: puzzleSchema.nullable().optional(),
  puzzles: z
    .object({ done: count, session: count, available: z.boolean() })
    .optional(),
  /** Games analysed and still waiting, so an empty deck can say why. */
  games: z.object({ analyzed: count, pending: count }).optional(),
  puzzle_results: z
    .array(
      z.object({
        id: z.string(),
        correct: z.boolean(),
        rating: z.number().int().nullable(),
        themes: z.array(z.string()),
      }),
    )
    .optional(),
  /** Tonight's extra watch (`mode=extra`): its progress, and the extra
   * watches kept tonight (this one once done). */
  extra: z
    .object({ done: count, total: count, kept: count })
    .refine((t) => t.done <= t.total, 'More done than the watch holds')
    .nullish(),
  results: z.array(
    z.object({
      game_id: z.number().int().positive(),
      ply: z.number().int().positive(),
      /** The mistake's tactic tag. Optional while the backend deploys separately. */
      pattern: z.string().nullable().optional(),
      correct: z.boolean(),
      mark: z.enum(['found', 'good', 'helped', 'missed']),
      san: z.string(),
      opponent: z.string().nullable(),
      /** The card's next due day; older servers omit it. */
      due: day.nullish(),
      /** It stopped slipping today (held for 11+ days); older servers omit it. */
      stopped: z.boolean().optional(),
      /** Its name on the watch, sent only when it stopped slipping. */
      label: z.string().nullish(),
    }),
  ),
});
export const answerSchema = z
  .object({
    correct: z.boolean(),
    quality: z.enum(['best', 'excellent', 'good', 'wrong', 'shown']),
    rating: z.enum(['again', 'hard', 'good', 'easy']).nullable(),
    best_uci: uci,
    best_san: z.string(),
    due: day.nullable(),
    mastered: z.boolean(),
  })
  .refine(
    (answer) =>
      answer.correct === ['best', 'excellent', 'good'].includes(answer.quality),
    'Inconsistent grade',
  );
const passing = (quality: string) =>
  ['best', 'excellent', 'good'].includes(quality);
/** The full solution from the exercise position; learner moves at even indexes. */
const lineSchema = z
  .object({ uci: z.array(uci).min(1), san: z.array(z.string().min(1)) })
  .refine(
    (line) => line.uci.length % 2 === 1 && line.san.length === line.uci.length,
    'Malformed line',
  );
const terminalSchema = z
  .object({
    status: z.enum(['solved', 'failed', 'shown']),
    step: count,
    correct: z.boolean(),
    quality: z.enum(['best', 'excellent', 'good', 'wrong', 'shown']),
    rating: z.enum(['again', 'hard', 'good', 'easy']).nullable(),
    best_uci: uci,
    best_san: z.string(),
    line: lineSchema,
    due: day.nullable(),
    mastered: z.boolean(),
    /** The prepared explanation of a failed first move, and the line's why. */
    explanation: explanationSchema.nullable().optional().catch(null),
    why: whySchema.nullable().optional().catch(null),
    /** The top moves with a reason each, from the prepared map. */
    candidates: candidatesSchema.nullable().optional().catch(null),
  })
  .refine(
    (answer) =>
      answer.correct === passing(answer.quality) &&
      answer.correct === (answer.status === 'solved') &&
      (answer.quality === 'shown') === (answer.status === 'shown') &&
      2 * answer.step < answer.line.uci.length &&
      answer.line.uci[2 * answer.step] === answer.best_uci,
    'Inconsistent grade',
  );
/** One step of a line: the opponent's reply, or the finished, graded answer. */
export const stepSchema = z.union([
  z.object({
    status: z.literal('continue'),
    step: count,
    reply_uci: uci,
    reply_san: z.string().min(1),
  }),
  terminalSchema,
]);
export const hintSchema = z
  .object({ best_uci: uci, from: z.string().regex(/^[a-h][1-8]$/) })
  .refine(
    (hint) => hint.from === moveFromUci(hint.best_uci).from,
    'Inconsistent hint',
  );
export type Deck = z.infer<typeof deckSchema>;
export type PracticeCard = z.infer<typeof cardSchema>;
export type CardFeedback = z.infer<typeof cardFeedbackSchema>;
export type PracticeAnswer = z.infer<typeof answerSchema>;
export type AnswerInput = components['schemas']['AnswerIn'];
export type PracticePuzzle = z.infer<typeof puzzleSchema>;
export type CoachExplanation = z.infer<typeof explanationSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type PracticeStep = z.infer<typeof stepSchema>;
export type PracticeResult = z.infer<typeof terminalSchema>;
export type HintInput = components['schemas']['HintIn'];
export type PuzzleAnswerInput = components['schemas']['PuzzleAnswerIn'];
export type PuzzleHintInput = components['schemas']['PuzzleHintIn'];
export type UnannouncedAnswerInput =
  components['schemas']['UnannouncedAnswerIn'];

/** Why a position was hidden ("Don't show this again"). */
const suspendReasons = ['engine_wrong', 'not_useful', 'already_known'] as const;
export type SuspendReason = (typeof suspendReasons)[number];
export const suspendResultSchema = z.object({ suspended: z.boolean() });
/** `GET /api/deck/suspended`: hidden positions, most recently hidden first. */
export const suspendedCardsSchema = z.array(
  z.object({
    game_id: z.number().int().positive(),
    ply: z.number().int().positive(),
    suspended_at: z.string(),
    reason: z.enum(suspendReasons).nullable(),
    san: z.string().min(1),
    move_number: z.number().int().positive(),
    color,
    pattern: z.string().nullable(),
    opponent: z.string().nullable(),
    played_at: z.string().nullable(),
  }),
);
export type SuspendedCard = z.infer<typeof suspendedCardsSchema>[number];
