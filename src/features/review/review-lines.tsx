import { useQuery } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import { playUci } from '../../chess/move';
import type { EngineLines } from '../../lib/api/review-contract';

type LineKind = 'best' | 'why';
/** An engine line opened from Best or Explain, played as a side line. */
export type LineRequest = { kind: LineKind; ply: number };
/** Fetches a ply's engine lines (the API in the app, samples in the preview),
 * cached under `key` and the ply. `peek` answers at once for lines already in
 * hand (the game's stored lines, fetched when review opens), so Best and Why
 * open with no loading step. */
export type LoadLines = ((
  ply: number,
  signal: AbortSignal,
) => Promise<EngineLines>) & {
  key: readonly unknown[];
  peek?: (ply: number) => EngineLines | undefined;
};

const sameFen = (a: string, b: string) =>
  new Chess(a).fen() === new Chess(b).fen();

/** Loads the requested line and checks it starts from the expected position;
 * the review session then plays it as a side line. `before`/`after` are the
 * positions around the ply. */
export function useEngineLine({
  load,
  request,
  before,
  after,
}: {
  load: LoadLines;
  request?: LineRequest;
  before?: string;
  after?: string;
}) {
  const ply = request?.ply;
  const known = ply === undefined ? undefined : load.peek?.(ply);
  const query = useQuery({
    queryKey: [...load.key, ply],
    queryFn: ({ signal }) => load(ply ?? 0, signal),
    enabled: ply !== undefined && !known,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const lines = known ?? query.data;
  if (!request) return { status: 'idle' as const };
  if (!lines && query.isError && !query.isFetching)
    return {
      status: 'error' as const,
      message:
        query.error instanceof Error
          ? query.error.message
          : 'Line unavailable.',
      retry: () => void query.refetch(),
    };
  if (!lines) return { status: 'loading' as const };
  const line = lines[request.kind];
  const expected = request.kind === 'best' ? before : after;
  const valid =
    !!line && !!expected && sameFen(line.start_fen, expected) && legal(line);
  if (!line || !valid) return { status: 'missing' as const };
  return {
    status: 'ready' as const,
    moves: line.moves,
    // Best starts before the move, Why after it.
    start: request.kind === 'best' ? request.ply - 1 : request.ply,
    summary: line.summary?.replace(/\[\[[wb]:([^\]]+)\]\]/g, '$1') ?? null,
  };
}
function legal(line: { start_fen: string; moves: readonly string[] }) {
  try {
    const chess = new Chess(line.start_fen);
    for (const uci of line.moves) playUci(chess, uci);
    return line.moves.length > 0;
  } catch {
    return false;
  }
}
