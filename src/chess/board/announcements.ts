import type { Square } from 'chess.js';
import { type Piece, pieceNames } from '../position';
import { type MoveGrade, moveGrades } from './move-grade';

export function squareLabel(square: Square, piece?: Piece): string {
  return `${square}, ${piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${pieceNames[piece.kind]}` : 'empty'}`;
}

export type SquareNotes = Readonly<{
  grade?: MoveGrade;
  hint?: boolean;
  correct?: boolean;
  /** The colour of the user's own highlight on this square. */
  userMark?: string;
  check?: 'in check' | 'checkmate, losing king' | 'winner';
}>;

/** What a screen reader says for a square, on web and native alike. */
export function squareDescription(
  square: Square,
  piece: Piece | undefined,
  notes: SquareNotes,
): string {
  return [
    squareLabel(square, piece),
    notes.grade && `${moveGrades[notes.grade].label} move`,
    notes.hint && 'hint: piece to move',
    notes.correct && 'correct answer',
    notes.userMark && `user highlight, ${notes.userMark}`,
    notes.check,
  ]
    .filter(Boolean)
    .join(', ');
}
export function createAnnouncementGate() {
  const seen = new Set<string>();
  let lastCurrent: string | undefined;
  return {
    claim(id: string, replaySafe = true) {
      if (!replaySafe) {
        if (lastCurrent === id) return false;
        lastCurrent = id;
        return true;
      }
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    },
  };
}
