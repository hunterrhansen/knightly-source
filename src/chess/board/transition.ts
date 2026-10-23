import type { Square } from 'chess.js';
import {
  type ParsedPosition,
  type Piece,
  type Position,
  parsePosition,
} from '../position';
import type { BoardProps, PieceMotion, Transition } from './board.types';

type MoveMetadata = Readonly<{
  motions: readonly PieceMotion[];
  capturedSquare?: Transition['capturedSquare'];
}>;
export function createTransition(
  identity: Pick<Transition, 'id' | 'positionId' | 'reason'>,
  metadata?: MoveMetadata,
): Transition {
  if (identity.reason === 'navigation' || identity.reason === 'reset')
    return { ...identity, motions: [] };
  return {
    ...identity,
    motions: metadata?.motions ?? [],
    ...(metadata?.capturedSquare
      ? { capturedSquare: metadata.capturedSquare }
      : {}),
  };
}
type ResolvedPresentation =
  | Readonly<{
      ok: true;
      position: Position;
      parsed: ParsedPosition;
      submissionEnabled: boolean;
    }>
  | Readonly<{ ok: false; message: string; submissionEnabled: false }>;
export function resolvePresentation({
  position,
  presentation,
  feedback,
  policy,
}: Pick<
  BoardProps,
  'position' | 'presentation' | 'feedback' | 'policy'
>): ResolvedPresentation {
  const confirmed = parsePosition(position.fen);
  if (!confirmed.ok) return { ...confirmed, submissionEnabled: false };
  const preview = presentation.preview;
  if (
    preview &&
    (preview.positionId !== position.id ||
      !feedback ||
      feedback.positionId !== position.id ||
      preview.attemptId !== feedback.attemptId)
  ) {
    return {
      ok: false,
      message:
        'Position unavailable: the attempted position does not match current feedback.',
      submissionEnabled: false,
    };
  }
  const parsed = preview ? parsePosition(preview.fen) : confirmed;
  if (!parsed.ok) return { ...parsed, submissionEnabled: false };
  return {
    ok: true,
    position: { id: position.id, fen: preview?.fen ?? position.fen },
    parsed: parsed.value,
    submissionEnabled: policy.mode === 'movable' && policy.submissionEnabled,
  };
}

type TransitionGate = {
  begin(transition: Transition): void;
  complete(transitionId: string, positionId: string): boolean;
  cancel(): void;
};
export function createTransitionGate(): TransitionGate {
  let active: Transition | undefined;
  const completed = new Set<string>();
  const key = (id: string, positionId: string) =>
    JSON.stringify([id, positionId]);
  return {
    begin(transition) {
      active = transition;
    },
    complete(id, positionId) {
      if (
        active?.id !== id ||
        active.positionId !== positionId ||
        completed.has(key(id, positionId))
      )
        return false;
      completed.add(key(id, positionId));
      active = undefined;
      return true;
    },
    cancel() {
      active = undefined;
    },
  };
}

const distance = (a: Square, b: Square) =>
  Math.hypot(
    a.charCodeAt(0) - b.charCodeAt(0),
    a.charCodeAt(1) - b.charCodeAt(1),
  );
// How far a morph slides a piece. Between unrelated positions, long slides
// cross the board in a tangle; farther pieces fade in where they stand instead.
const MORPH_REACH = 2;
/** Pairs each piece with the nearest one of its kind and colour in the new
 * position, closest pairs first, as Lichess's board does between positions.
 * Pieces left on their square keep it; paired pieces within `reach` squares
 * slide; the rest appear. */
function morph(
  previous: readonly VisualPiece[],
  pieces: readonly Piece[],
  positionId: string,
  reach = Number.POSITIVE_INFINITY,
): readonly VisualPiece[] {
  const kindOf = (piece: Piece) => `${piece.color}${piece.kind}`;
  const result = new Map<Square, VisualPiece>();
  const unplaced = pieces.filter((piece) => {
    const stay = previous.find(
      (old) => old.square === piece.square && kindOf(old) === kindOf(piece),
    );
    if (stay)
      result.set(piece.square, {
        ...piece,
        id: stay.id,
      });
    return !stay;
  });
  const free = previous.filter(
    (old) => ![...result.values()].some((kept) => kept.id === old.id),
  );
  const pairs = unplaced
    .flatMap((piece) =>
      free
        .filter((old) => kindOf(old) === kindOf(piece))
        .map((old) => ({ piece, old, d: distance(old.square, piece.square) }))
        .filter(({ d }) => d <= reach * Math.SQRT2),
    )
    .sort((a, b) => a.d - b.d);
  const used = new Set<string>();
  for (const { piece, old } of pairs) {
    if (result.has(piece.square) || used.has(old.id)) continue;
    used.add(old.id);
    result.set(piece.square, { ...piece, id: old.id, from: old.square });
  }
  return pieces.map(
    (piece) =>
      result.get(piece.square) ?? {
        ...piece,
        // New to the board: an id no earlier piece can still hold.
        id: `${positionId}:new:${piece.color}${piece.kind}:${piece.square}`,
        appear: true,
      },
  );
}

export type VisualPiece = Piece &
  Readonly<{
    id: string;
    from?: Square;
    travelingKind?: Piece['kind'];
    /** Fades in: a morph brought it with no counterpart close enough. */
    appear?: boolean;
    /** Drops in from above as it fades in: it arrived on an empty board
     * (a lesson's first position, after the loading frame). */
    enter?: boolean;
  }>;
/** Only explicit, fully matching metadata may connect piece identities. */
export function reconcilePieces(
  previous: readonly VisualPiece[] | undefined,
  pieces: readonly Piece[],
  positionId: string,
  transition?: Transition,
): readonly VisualPiece[] {
  const rebuild = () =>
    pieces.map((piece) => ({
      ...piece,
      id: `${positionId}:${transition?.id ?? 'base'}:${piece.square}`,
    }));
  // Pieces arriving on an empty board drop in, whatever the transition: the
  // loading frame shows the board before its first position.
  if (previous?.length === 0 && pieces.length)
    return pieces.map((piece) => ({
      ...piece,
      id: `${positionId}:enter:${piece.square}`,
      appear: true,
      enter: true,
    }));
  if (
    previous &&
    transition?.reason === 'morph' &&
    transition.positionId === positionId
  )
    return morph(previous, pieces, positionId, MORPH_REACH);
  // Without trusted move metadata nothing travels, but pieces still keep their
  // identity (nearest of the same kind), so a jump redraws instead of
  // remounting every piece.
  const snap = () =>
    previous
      ? morph(previous, pieces, positionId).map(
          ({ from: _from, appear: _appear, ...piece }) => piece,
        )
      : rebuild();
  if (
    !previous ||
    transition?.reason === 'navigation' ||
    transition?.reason === 'reset'
  )
    return snap();
  const same = (left: Piece, right: Piece | undefined) =>
    left.square === right?.square &&
    left.kind === right.kind &&
    left.color === right.color;
  if (
    previous.length === pieces.length &&
    pieces.every((piece) => previous.some((old) => same(piece, old)))
  )
    return pieces.map((piece) => ({
      ...piece,
      id:
        previous.find((old) => same(piece, old))?.id ??
        `${positionId}:${piece.square}`,
    }));
  if (
    !transition ||
    transition.positionId !== positionId ||
    !transition.motions.length
  )
    return snap();
  if (
    new Set(transition.motions.map((motion) => motion.from)).size !==
      transition.motions.length ||
    new Set(transition.motions.map((motion) => motion.to)).size !==
      transition.motions.length
  )
    return snap();
  if (transition.capturedSquare) {
    const captured = previous.find(
      (piece) => piece.square === transition.capturedSquare,
    );
    if (
      !captured ||
      transition.motions.some(
        (motion) =>
          motion.from === transition.capturedSquare ||
          motion.color === captured.color,
      )
    )
      return snap();
  }
  const expected = new Map<Square, VisualPiece>(
    previous.map(
      ({ from: _from, travelingKind: _kind, appear: _appear, ...piece }) => [
        piece.square,
        piece,
      ],
    ),
  );
  if (transition.capturedSquare) expected.delete(transition.capturedSquare);
  const restored = transition.restoredSquare
    ? pieces.find((piece) => piece.square === transition.restoredSquare)
    : undefined;
  const moving = transition.motions.map((motion) => ({
    motion,
    piece: previous.find((piece) => piece.square === motion.from),
  }));
  if (
    moving.some(
      ({ motion, piece }) =>
        !piece || piece.kind !== motion.kind || piece.color !== motion.color,
    )
  )
    return snap();
  for (const { motion } of moving) expected.delete(motion.from);
  for (const { motion, piece } of moving) {
    if (!piece) return snap();
    expected.set(motion.to, {
      ...piece,
      square: motion.to,
      kind: motion.promotedTo ?? motion.kind,
      from: motion.from,
      travelingKind: motion.kind,
    });
  }
  if (restored && !expected.has(restored.square))
    expected.set(restored.square, {
      ...restored,
      id: `${positionId}:${transition.id}:${restored.square}`,
    });
  if (
    expected.size !== pieces.length ||
    !pieces.every((piece) => same(piece, expected.get(piece.square)))
  )
    return snap();
  return pieces.flatMap((piece) => {
    const visual = expected.get(piece.square);
    return visual ? [visual] : [];
  });
}
