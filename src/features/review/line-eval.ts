import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  type LinePath,
  type LineTree,
  nodesAlong,
  pathKey,
} from '../../chess/line-tree';
import { type EngineLine, getStockfish } from '../../lib/engine/stockfish';

/** A side line's evaluation as the review shows it: from White's side. */
export type LineEval =
  | { status: 'idle' | 'thinking' | 'unavailable' }
  | {
      status: 'ready';
      /** White's win chance, 0–100, on the backend's (Lichess's) curve. */
      white: number;
      /** +0.35, −1.20, M3 or −M3, as the game's evals read. */
      text: string;
      depth: number;
      /** The engine's move, once the search is deep enough to draw it. */
      best?: string;
      /** The search stopped at its limit. */
      done: boolean;
    };

// Phones stop sooner, to spare the battery; the browser searches a little deeper.
const limit =
  Platform.OS === 'web'
    ? { depth: 22, movetime: 5000 }
    : { depth: 20, movetime: 3000 };
/** The best-move arrow waits for a search this deep, so it does not flicker. */
const ARROW_DEPTH = 12;
// analyze.py's win_pct: Lichess's curve, evals clamped to ±1000 cp.
const LICHESS_K = 0.00368208;
const winPct = (cp: number) => {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-LICHESS_K * clamped)) - 1);
};

/** The position as the engine needs it: the last position after a capture or
 * pawn move, then the moves since, so it sees repetitions (as Lichess sends). */
export function engineRequest(tree: LineTree, path: LinePath) {
  let fen = tree.fen;
  let moves: string[] = [];
  for (const node of nodesAlong(tree, path)) {
    if (node.fen.split(' ')[4] === '0') {
      fen = node.fen;
      moves = [];
    } else moves.push(node.uci);
  }
  return { fen, moves };
}

/** An engine line, scored from the side to move, as the review shows it. */
export function fromWhite(
  line: EngineLine,
  turn: 'w' | 'b',
  done: boolean,
): Extract<LineEval, { status: 'ready' }> {
  const sign = turn === 'w' ? 1 : -1;
  const value = line.score.value * sign;
  const mate = line.score.type === 'mate';
  return {
    status: 'ready',
    white: mate ? (value > 0 ? 100 : 0) : winPct(value),
    text: mate
      ? `${value < 0 ? '−' : ''}M${Math.abs(value)}`
      : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value / 100).toFixed(2)}`,
    depth: line.depth,
    best: line.depth >= ARROW_DEPTH ? line.pv[0] : undefined,
    done,
  };
}

/**
 * Evaluates the side line on the board with the device's Stockfish: a search
 * starts when the line's position changes and stops when it changes again or
 * the review closes. A result for a position the board has left is dropped;
 * finished results are kept for the visit.
 */
export function useLineEval(tree: LineTree | undefined, path?: LinePath) {
  const key = path ? pathKey(path) : undefined;
  const cache = useRef(new Map<string, LineEval>());
  const [shown, setShown] = useState<{ key: string; eval: LineEval }>();
  // The search stops while the app is in the background (or the tab hidden)
  // and starts again on return, to spare the battery.
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the path's key names the position; the tree only grows around it
  useEffect(() => {
    if (
      !active ||
      !tree ||
      !path ||
      key === undefined ||
      cache.current.has(key)
    )
      return;
    const { fen, moves } = engineRequest(tree, path);
    const end = nodesAlong(tree, path).at(-1)?.fen ?? tree.fen;
    const turn = end.split(' ')[1] === 'b' ? 'b' : 'w';
    const controller = new AbortController();
    setShown({ key, eval: { status: 'thinking' } });
    getStockfish()
      .search(
        {
          fen,
          moves,
          limit,
          onUpdate: (lines) => {
            const first = lines[0];
            if (first && !controller.signal.aborted)
              setShown({ key, eval: fromWhite(first, turn, false) });
          },
        },
        controller.signal,
      )
      .then(
        (result) => {
          const first = result.lines[0];
          // No line: the game is over on the board (mate or stalemate).
          const final: LineEval = first
            ? fromWhite(first, turn, true)
            : { status: 'idle' };
          cache.current.set(key, final);
          if (!controller.signal.aborted) setShown({ key, eval: final });
        },
        (error: Error) => {
          if (error.name === 'AbortError') return;
          const failed: LineEval = { status: 'unavailable' };
          cache.current.set(key, failed);
          setShown({ key, eval: failed });
        },
      );
    return () => controller.abort();
  }, [key, active]);
  if (key === undefined) return { status: 'idle' } as const;
  return (
    cache.current.get(key) ??
    (shown?.key === key ? shown.eval : ({ status: 'thinking' } as const))
  );
}
