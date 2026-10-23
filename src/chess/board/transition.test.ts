import { applyMove } from '../move';
import { parsePosition } from '../position';
import {
  captureFen,
  castleFen,
  enPassantFen,
  promotionFen,
  startFen,
} from '../test-fixtures';
import type { BoardProps } from './board.types';
import {
  createTransition,
  reconcilePieces,
  resolvePresentation,
} from './transition';

const props = {
  position: { id: 'p1', fen: startFen },
  orientation: 'w',
  policy: {
    mode: 'movable',
    sides: ['w'],
    moves: [{ from: 'e2', to: 'e4' }],
    submissionEnabled: true,
  },
  presentation: { showDestinations: false, highlights: [], arrows: [] },
  onAttempt: () => {},
} satisfies BoardProps;
const preview = {
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  positionId: 'p1',
  attemptId: 'a1',
};
const feedback = {
  positionId: 'p1',
  attemptId: 'a1',
  outcome: 'pending',
  message: 'Checking',
} as const;

test('correlated preview is displayed without replacing confirmed identity', () => {
  const result = resolvePresentation({
    ...props,
    feedback,
    presentation: { ...props.presentation, preview },
  });
  expect(result).toMatchObject({
    ok: true,
    position: { id: 'p1', fen: preview.fen },
  });
});
test.each([
  { feedback: undefined, preview },
  { feedback, preview: { ...preview, positionId: 'old' } },
  { feedback, preview: { ...preview, attemptId: 'old' } },
  { feedback: { ...feedback, positionId: 'old' }, preview },
  { feedback, preview: { ...preview, fen: 'invalid' } },
])('unusable preview fails closed and disables submission', (candidate) => {
  expect(
    resolvePresentation({
      ...props,
      feedback: candidate.feedback,
      presentation: { ...props.presentation, preview: candidate.preview },
    }),
  ).toMatchObject({
    ok: false,
    submissionEnabled: false,
    message: expect.stringMatching(/position unavailable/i),
  });
});
test('invalid confirmed position cannot be hidden by a valid preview', () => {
  expect(
    resolvePresentation({
      ...props,
      position: { id: 'p1', fen: 'invalid' },
      feedback,
      presentation: { ...props.presentation, preview },
    }),
  ).toMatchObject({ ok: false, submissionEnabled: false });
});
test('submission respects read-only and feature-controlled blocking', () => {
  expect(resolvePresentation(props)).toMatchObject({
    ok: true,
    submissionEnabled: true,
  });
  expect(
    resolvePresentation({ ...props, policy: { mode: 'read-only' } }),
  ).toMatchObject({ ok: true, submissionEnabled: false });
  expect(
    resolvePresentation({
      ...props,
      policy: { ...props.policy, submissionEnabled: false },
    }),
  ).toMatchObject({ ok: true, submissionEnabled: false });
});

const piecesFor = (fen: string) => {
  const parsed = parsePosition(fen);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value.pieces;
};
test.each([
  [castleFen, { from: 'e1', to: 'g1' }],
  [enPassantFen, { from: 'e5', to: 'd6' }],
  [promotionFen, { from: 'a7', to: 'a8', promotion: 'n' }],
  [captureFen, { from: 'e2', to: 'd3' }],
] as const)(
  'explicit special move preserves identities and removes captured pieces: %s',
  (fen, move) => {
    const before = reconcilePieces(undefined, piecesFor(fen), 'p1');
    const applied = applyMove(fen, move);
    const transition = createTransition(
      { id: 't1', positionId: 'p2', reason: 'confirmed' },
      applied,
    );
    const after = reconcilePieces(
      before,
      piecesFor(applied.fen),
      'p2',
      transition,
    );
    expect(after.filter((piece) => piece.from)).toHaveLength(
      applied.motions.length,
    );
    for (const motion of applied.motions) {
      expect(after.find((piece) => piece.square === motion.to)).toMatchObject({
        id: before.find((piece) => piece.square === motion.from)?.id,
        from: motion.from,
        kind: motion.promotedTo ?? motion.kind,
      });
    }
    if (applied.capturedSquare)
      expect(
        after.some(
          (piece) =>
            piece.id ===
            before.find((piece) => piece.square === applied.capturedSquare)?.id,
        ),
      ).toBe(false);
  },
);
test('stepping back over a capture slides the piece home and restores the captured one', () => {
  const applied = applyMove(captureFen, { from: 'e2', to: 'd3' });
  const after = reconcilePieces(undefined, piecesFor(applied.fen), 'p2');
  const back = reconcilePieces(after, piecesFor(captureFen), 'p1', {
    id: 'step',
    positionId: 'p1',
    reason: 'replay',
    motions: [{ from: 'd3', to: 'e2', color: 'w', kind: 'p' }],
    restoredSquare: 'd3',
  });
  expect(back.find((piece) => piece.square === 'e2')).toMatchObject({
    id: after.find((piece) => piece.square === 'd3')?.id,
    from: 'd3',
  });
  // The captured piece is back on its square, without travel.
  expect(back.find((piece) => piece.square === 'd3')).toMatchObject({
    color: 'b',
  });
  expect(back.find((piece) => piece.square === 'd3')?.from).toBeUndefined();
});
test('preview acceptance retains IDs and never replays movement', () => {
  const before = reconcilePieces(undefined, piecesFor(startFen), 'p1');
  const applied = applyMove(startFen, { from: 'e2', to: 'e4' });
  const preview = reconcilePieces(
    before,
    piecesFor(applied.fen),
    'p1',
    createTransition(
      { id: 'attempt', positionId: 'p1', reason: 'attempt' },
      applied,
    ),
  );
  const accepted = reconcilePieces(
    preview,
    piecesFor(applied.fen),
    'p2',
    createTransition(
      { id: 'accept', positionId: 'p2', reason: 'confirmed' },
      applied,
    ),
  );
  expect(accepted.map((piece) => piece.id)).toEqual(
    preview.map((piece) => piece.id),
  );
  expect(accepted.some((piece) => piece.from)).toBe(false);
});
test('navigation, reset and stale metadata show only the current position, without travel', () => {
  const before = reconcilePieces(undefined, piecesFor(startFen), 'p1');
  const applied = applyMove(startFen, { from: 'e2', to: 'e4' });
  for (const transition of [
    undefined,
    createTransition({ id: 'nav', positionId: 'p2', reason: 'navigation' }),
    createTransition(
      { id: 'reset', positionId: 'p2', reason: 'reset' },
      applied,
    ),
    createTransition(
      { id: 'stale', positionId: 'old', reason: 'confirmed' },
      applied,
    ),
  ]) {
    const after = reconcilePieces(
      before,
      piecesFor(applied.fen),
      'p2',
      transition,
    );
    expect(after.some((piece) => piece.from)).toBe(false);
    expect(new Set(after.map((piece) => piece.id)).size).toBe(after.length);
    // Pieces that stay keep their identity, so a jump never remounts them.
    expect(after.find((piece) => piece.square === 'a1')?.id).toBe(
      before.find((piece) => piece.square === 'a1')?.id,
    );
  }
});

test('repeated morphs never give two pieces the same identity', () => {
  // A pawn appears on e4, moves to e5, then a second pawn appears on e4.
  const fens = [
    '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1',
    '4k3/8/8/4P3/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/4P3/4P3/8/8/4K3 w - - 0 1',
  ];
  let shown = reconcilePieces(undefined, piecesFor(fens[0] ?? ''), 'p0');
  fens.slice(1).forEach((fen, i) => {
    const id = `p${i + 1}`;
    shown = reconcilePieces(
      shown,
      piecesFor(fen),
      id,
      createTransition({ id, positionId: id, reason: 'morph' }),
    );
    expect(new Set(shown.map((piece) => piece.id)).size).toBe(shown.length);
  });
});

test('duplicate motion origins and contradictory captures cannot preserve duplicated identities', () => {
  const before = reconcilePieces(
    undefined,
    piecesFor('4k3/8/8/8/8/8/8/R3K2R w - - 0 1'),
    'p1',
  );
  const after = reconcilePieces(
    before,
    piecesFor('4k3/8/8/8/8/8/R7/4K2R w - - 0 1'),
    'p2',
    {
      id: 'malformed',
      positionId: 'p2',
      reason: 'confirmed',
      capturedSquare: 'h1',
      motions: [
        { from: 'a1', to: 'a2', kind: 'r', color: 'w' },
        { from: 'a1', to: 'h1', kind: 'r', color: 'w' },
      ],
    },
  );
  expect(new Set(after.map((piece) => piece.id)).size).toBe(after.length);
  expect(after.some((piece) => piece.from)).toBe(false);
});
test('a morph slides each piece to the nearest square its kind holds next; the rest appear', () => {
  const before = reconcilePieces(
    undefined,
    piecesFor('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
    'p1',
  );
  const next = piecesFor('4k3/8/8/8/8/3P4/8/3K2N1 w - - 0 1');
  const shown = reconcilePieces(
    before,
    next,
    'p2',
    createTransition({ id: 't', positionId: 'p2', reason: 'morph' }),
  );
  const at = (square: string) => shown.find((p) => p.square === square);
  const was = (square: string) => before.find((p) => p.square === square)?.id;
  // The black king stays put; the white king and pawn slide one square.
  expect(at('e8')).toMatchObject({ id: was('e8') });
  expect(at('e8')?.from).toBeUndefined();
  expect(at('d1')).toMatchObject({ id: was('e1'), from: 'e1' });
  expect(at('d3')).toMatchObject({ id: was('e2'), from: 'e2' });
  // The knight has no counterpart, so it simply appears.
  expect(at('g1')?.from).toBeUndefined();
  expect(shown).toHaveLength(next.length);
});
test('a morph between unrelated positions fades far pieces in instead of sliding them across the board', () => {
  const before = reconcilePieces(
    undefined,
    piecesFor('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'),
    'p1',
  );
  const shown = reconcilePieces(
    before,
    piecesFor('4k3/7R/8/8/8/8/8/3K4 w - - 0 1'),
    'p2',
    createTransition({ id: 't', positionId: 'p2', reason: 'morph' }),
  );
  const at = (square: string) => shown.find((p) => p.square === square);
  // The king's one-square step still slides.
  expect(at('d1')).toMatchObject({ from: 'e1' });
  expect(at('d1')?.appear).toBeUndefined();
  // The rook would cross the whole board, so it fades in on h7 instead.
  expect(at('h7')?.from).toBeUndefined();
  expect(at('h7')?.appear).toBe(true);
});

test('only a board that was showing no pieces drops its arrivals in', () => {
  const empty = reconcilePieces(undefined, [], 'loading');
  const first = reconcilePieces(empty, piecesFor(startFen), 'p1');
  expect(first).toHaveLength(32);
  expect(first.every((piece) => piece.enter && piece.appear)).toBe(true);
  // A board opening straight on a position, or moving between positions,
  // never drops its pieces.
  expect(
    reconcilePieces(undefined, piecesFor(startFen), 'p1').some((p) => p.enter),
  ).toBe(false);
  const next = reconcilePieces(
    first,
    piecesFor('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    'p2',
    createTransition({ id: 'p2', positionId: 'p2', reason: 'morph' }),
  );
  expect(next.some((piece) => piece.enter)).toBe(false);
});
