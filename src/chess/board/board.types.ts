import type { Color, PieceSymbol, Square } from 'chess.js';
import type { Position } from '../position';
import type { LandingCurve } from './motion-settings';
import type { MoveGrade } from './move-grade';

export type Promotion = 'q' | 'r' | 'b' | 'n';
export type MoveVariant = Readonly<{
  from: Square;
  to: Square;
  promotion?: Promotion;
}>;
export type InputSource = 'activation' | 'drag' | 'keyboard';
export type MoveAttempt = MoveVariant &
  Readonly<{ attemptId: string; positionId: string; source: InputSource }>;
export type Feedback = Readonly<{
  attemptId: string;
  positionId: string;
  outcome: 'pending' | 'rejected' | 'resolved' | 'failed' | 'uncertain';
  message: string;
}>;
export type Policy =
  | Readonly<{ mode: 'read-only' }>
  | Readonly<{
      mode: 'movable';
      sides: readonly Color[];
      moves: readonly MoveVariant[];
      submissionEnabled: boolean;
    }>;
export type PieceMotion = Readonly<{
  from: Square;
  to: Square;
  color: Color;
  kind: PieceSymbol;
  promotedTo?: Promotion;
}>;
export type Transition = Readonly<{
  id: string;
  positionId: string;
  reason:
    | 'attempt'
    | 'confirmed'
    | 'opponent'
    | 'retry'
    /** Stepping through a game's moves; plays like a move in either direction. */
    | 'replay'
    | 'navigation'
    | 'reset'
    /** A new position replacing the board, as Lichess does between puzzles:
     * each piece slides to the nearest square its kind holds next; the rest
     * appear or disappear. The board computes the motions; none are given. */
    | 'morph';
  motions: readonly PieceMotion[];
  capturedSquare?: Square;
  /** A captured piece that reappears here when stepping back over a capture. */
  restoredSquare?: Square;
}>;
export type Presentation = Readonly<{
  showDestinations: boolean;
  // Display metadata only; the owning feature supplies the grade.
  grade?: Readonly<{ square: Square; kind: MoveGrade; id?: string }>;
  // Feature-owned hint source and one-shot correct-answer event: the correct
  // sound, and a check badge on `square` when the answer has one (a "No
  // threat" answer has none). Change id to replay.
  hint?: Readonly<{ square: Square }>;
  correct?: Readonly<{ square?: Square; id: string }>;
  lastMove?: MoveVariant;
  lineMode?: boolean;
  highlights: readonly Readonly<{
    square: Square;
    tone: 'hint' | 'success' | 'error';
    /** Error marks show the incorrect badge unless this is false. */
    badge?: boolean;
  }>[];
  arrows: readonly Readonly<{
    from: Square;
    to: Square;
    tone: 'best' | 'line' | 'danger' | 'hint' | 'analysis';
  }>[];
  preview?: Readonly<{ fen: string; attemptId: string; positionId: string }>;
  transition?: Transition;
  /** How a moved piece lands, as a scale curve (the watch kit's `fx.land`);
   * the default is a small press. */
  landing?: LandingCurve;
}>;
export type BoardProps = Readonly<{
  position: Position;
  orientation: Color;
  policy: Policy;
  presentation: Presentation;
  feedback?: Feedback;
  annotationsEnabled?: boolean;
  onAttempt: (attempt: MoveAttempt) => void;
  onTransitionComplete?: (
    event: Readonly<{ transitionId: string; positionId: string }>,
  ) => void;
  onRestorePosition?: () => void;
}>;

export type BoardAccessibilityProps = Readonly<{
  orientation: Color;
  positionId: string;
  renderSquare: (square: Square, focused: boolean) => React.ReactNode;
  onActivate: (square: Square, source: InputSource) => void;
  onCancel: () => void;
  status: string;
  statusId: string;
  statusReplaySafe?: boolean;
  label: string;
  hidden: boolean;
  labels: ReadonlyMap<Square, string>;
  selected?: Square;
  focusRequest?: Readonly<{ square: Square; id: number }>;
}>;

export type BoardSound =
  | 'move-self'
  | 'move-opponent'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'game-end'
  | 'illegal'
  | 'correct'
  | 'incorrect'
  /** Lesson points reaching the counter: a star shard, or the run bonus. */
  | 'coin'
  | 'coin-bonus';
