import { useEffect, useState } from 'react';
import type { MoveGrade } from '../../chess/board';
import {
  isMove,
  type LinePath,
  type LineTree,
  nodeAt,
} from '../../chess/line-tree';
import type { GameDetail } from '../../lib/api/review-contract';
import { ActionBar, ActionButton } from '../../ui';
import { PLAYER_BAND, PlayerBand } from './player-band';
import { clocksAt } from './player-clocks';
import {
  type LineRequest,
  type LoadLines,
  useEngineLine,
} from './review-lines';
import type { ReviewSession, ReviewState } from './review-session';

// "Nf5 is a mistake", "d4 is a book move".
export const phrase: Record<MoveGrade, string> = {
  brilliant: 'brilliant',
  great: 'a great move',
  best: 'best',
  excellent: 'excellent',
  good: 'good',
  book: 'a book move',
  inaccuracy: 'an inaccuracy',
  mistake: 'a mistake',
  blunder: 'a blunder',
  miss: 'a miss',
};
export const praised = new Set<MoveGrade>([
  'best',
  'book',
  'brilliant',
  'great',
]);

/** Chess.com's player rows: the side at the bottom under the board, its
 * opponent above, each with its clock at the shown position. */
export function playerBands(
  game: GameDetail,
  positions: string[],
  at: number,
  orientation: 'w' | 'b',
  /** A side line's position: its side to move, with the clocks of `at`. */
  shownFen = positions[at],
) {
  const clocks = clocksAt(game, at);
  const turn = shownFen?.split(' ')[1] === 'b' ? 'black' : 'white';
  const band = (color: 'white' | 'black') => (
    <PlayerBand
      name={game[color]}
      rating={color === 'white' ? game.white_elo : game.black_elo}
      color={color}
      clock={clocks?.[color]}
      toMove={turn === color}
      fen={positions[at]}
    />
  );
  const bottom = orientation === 'b' ? 'black' : 'white';
  return {
    above: band(bottom === 'white' ? 'black' : 'white'),
    under: band(bottom),
    bandHeight: PLAYER_BAND,
  };
}

export const orientationOf = (game: GameDetail, flipped: boolean) =>
  (game.color === 'black') !== flipped ? ('b' as const) : ('w' as const);

/** The engine line opened from Explain or Best: once loaded, the session
 * plays it as a side line. The request closes when that line leaves the
 * board (Back to game, or stepping back past its start). */
export function useAside(
  session: ReviewSession,
  state: ReviewState,
  at: string,
  load: LoadLines,
) {
  // A line belongs to the position it was opened on; moving on closes it.
  const [opened, setOpened] = useState<
    LineRequest & { at: string; placed?: boolean }
  >();
  const request = opened?.at === at ? opened : undefined;
  const positions = state.replay?.positions ?? [];
  const line = useEngineLine({
    load,
    request,
    before: request ? positions[request.ply - 1] : undefined,
    after: request ? positions[request.ply] : undefined,
  });
  const ready = line.status === 'ready' ? line : undefined;
  const missing = request?.placed === false;
  useEffect(() => {
    if (!request || request.placed !== undefined || !ready) return;
    const placed = session.openLine(ready.start, ready.moves);
    setOpened({ ...request, placed });
  }, [request, ready, session]);
  // Back to game or stepping out of the line ends the request with it.
  const hasLine = !!state.line;
  useEffect(() => {
    if (request?.placed && !hasLine) setOpened(undefined);
  }, [request?.placed, hasLine]);
  return {
    request,
    line: missing ? ({ status: 'missing' } as const) : line,
    open: (next: LineRequest) => setOpened({ ...next, at }),
    close: () => {
      setOpened(undefined);
      session.closeLine();
    },
  };
}
export type Aside = ReturnType<typeof useAside>;

export function asideCoach(aside: Aside) {
  const { line, request } = aside;
  const title = request?.kind === 'best' ? 'Best line' : 'Explaining';
  const body =
    line.status === 'ready'
      ? (line.summary ?? 'The engine’s line, move by move.')
      : line.status === 'loading'
        ? 'Loading the engine line…'
        : line.status === 'error'
          ? line.message
          : 'No engine line is available for this move.';
  return { title, body };
}

/** "5. Nxd4" or "5… exd4" for a move in the tree. */
export function moveLabel(tree: LineTree, path: LinePath) {
  const node = nodeAt(tree, path),
    parent = nodeAt(tree, path.slice(0, -1));
  if (!node || !parent || !isMove(node)) return 'Starting position';
  const [, turn, , , , number] = parent.fen.split(' ');
  return `${number}${turn === 'w' ? '.' : '…'} ${node.san}`;
}

/** The coach on a line you played: the move on the board and where the line
 * left the game. */
export function lineCoach(state: ReviewState) {
  const { tree, line } = state;
  if (!tree || !line) return { title: '' };
  const from = line.path.slice(0, line.start);
  return {
    title: moveLabel(tree, line.path),
    body: `Your line from ${from.length ? moveLabel(tree, from) : 'the start'}. Back to game returns.`,
  };
}

/** Back and Forward along the line on the board, and Back to game. */
export function LineControls({
  session,
  state,
  aside,
}: {
  session: ReviewSession;
  state: ReviewState;
  aside: Aside;
}) {
  const { tree, line } = state;
  const node = tree && line ? nodeAt(tree, line.path) : undefined;
  const failed =
    !line && aside.line.status === 'error' ? aside.line : undefined;
  return (
    <ActionBar>
      {line && (
        <>
          <ActionButton
            icon="previous"
            label="Back"
            accessibilityLabel="Previous move in line"
            shortcut="ArrowLeft"
            onPress={() => session.lineStep(-1)}
          />
          <ActionButton
            icon="next"
            label="Forward"
            accessibilityLabel="Next move in line"
            shortcut="ArrowRight"
            disabled={!node?.children.length}
            onPress={() => session.lineStep(1)}
          />
        </>
      )}
      {failed && (
        <ActionButton icon="retry" label="Retry" onPress={failed.retry} />
      )}
      <ActionButton
        icon="back"
        label="Back to game"
        primary
        shortcut="Escape Backspace"
        onPress={aside.close}
      />
    </ActionBar>
  );
}
