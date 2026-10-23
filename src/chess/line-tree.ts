import { Chess } from 'chess.js';
import { playUci } from './move';

/** Where a move came from: the game itself, a stored engine line, or the user. */
export type LineSource = 'game' | 'engine' | 'user';
export type LineNode = Readonly<{
  uci: string;
  san: string;
  /** The position after this move. */
  fen: string;
  /** Plies from the start: the game's own moves match their replay index. */
  ply: number;
  source: LineSource;
  /** The game's move first, then other lines in the order they were added. */
  children: readonly LineNode[];
}>;
export type LineTree = Readonly<{ fen: string; children: readonly LineNode[] }>;
/** The UCI moves from the start to a node; the empty path is the start. */
export type LinePath = readonly string[];

/** The game's moves as the tree's first line, as Lichess keeps the mainline
 * in `children[0]`. Stops at the first SAN that does not replay. */
export function gameTree(
  startFen: string | null | undefined,
  san: readonly string[],
) {
  const chess = new Chess(startFen ?? undefined);
  const root = chess.fen();
  const moves: { uci: string; san: string; fen: string }[] = [];
  for (const s of san) {
    try {
      const move = chess.move(s);
      moves.push({ uci: move.lan, san: move.san, fen: chess.fen() });
    } catch {
      break;
    }
  }
  let children: readonly LineNode[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    if (m) children = [{ ...m, ply: i + 1, source: 'game', children }];
  }
  return { fen: root, children } satisfies LineTree;
}

export const pathKey = (path: LinePath) => path.join('/');
/** A move, as opposed to the tree's starting position. */
export const isMove = (node: LineTree | LineNode): node is LineNode =>
  'uci' in node;

/** The node a path leads to: the tree itself for the empty path. */
export function nodeAt(
  tree: LineTree,
  path: LinePath,
): LineTree | LineNode | undefined {
  let node: LineTree | LineNode = tree;
  for (const uci of path) {
    const child: LineNode | undefined = node.children.find(
      (c) => c.uci === uci,
    );
    if (!child) return undefined;
    node = child;
  }
  return node;
}

/** The nodes along a path, first move first; shorter when the path leaves the tree. */
export function nodesAlong(tree: LineTree, path: LinePath): LineNode[] {
  const nodes: LineNode[] = [];
  let node: LineTree | LineNode = tree;
  for (const uci of path) {
    const child: LineNode | undefined = node.children.find(
      (c) => c.uci === uci,
    );
    if (!child) break;
    nodes.push(child);
    node = child;
  }
  return nodes;
}

/** How many of the path's moves are the game's own, from the start. */
export function gamePlies(tree: LineTree, path: LinePath) {
  let n = 0;
  for (const node of nodesAlong(tree, path)) {
    if (node.source !== 'game') break;
    n++;
  }
  return n;
}

/** The game's moves up to `ply`. */
export function gamePath(tree: LineTree, ply: number): string[] {
  const path: string[] = [];
  let node: LineTree | LineNode = tree;
  while (path.length < ply) {
    const next: LineNode | undefined = node.children[0];
    if (next?.source !== 'game') break;
    path.push(next.uci);
    node = next;
  }
  return path;
}

/** Rebuilds the nodes along `path`, replacing the last one's children. */
function replaceAt(
  node: LineTree | LineNode,
  path: LinePath,
  children: (node: LineTree | LineNode) => readonly LineNode[],
): LineTree | LineNode {
  const [head, ...rest] = path;
  if (head === undefined) return { ...node, children: children(node) };
  return {
    ...node,
    children: node.children.map((c) =>
      c.uci === head ? (replaceAt(c, rest, children) as LineNode) : c,
    ),
  };
}

/**
 * Plays `ucis` from `path`. A move the position already has steps into it;
 * any other move is added after the existing children, so the game's move
 * stays first. Returns the new tree and the path to the last move played, or
 * undefined when the path is unknown or a move is illegal.
 */
export function addLine(
  tree: LineTree,
  path: LinePath,
  ucis: readonly string[],
  source: Exclude<LineSource, 'game'>,
): { tree: LineTree; path: string[] } | undefined {
  const start = nodeAt(tree, path);
  if (!start) return undefined;
  const at = isMove(start) ? start.ply : 0;
  let shared = 0;
  let node: LineTree | LineNode = start;
  for (const uci of ucis) {
    const child: LineNode | undefined = node.children.find(
      (c) => c.uci === uci,
    );
    if (!child) break;
    node = child;
    shared++;
  }
  const fresh = ucis.slice(shared);
  const full = [...path, ...ucis];
  if (!fresh.length) return { tree, path: full };
  const chess = new Chess(node.fen);
  const built: { uci: string; san: string; fen: string }[] = [];
  try {
    for (const uci of fresh) {
      const move = playUci(chess, uci);
      built.push({ uci: move.lan, san: move.san, fen: chess.fen() });
    }
  } catch {
    return undefined;
  }
  let added: LineNode | undefined;
  for (let i = built.length - 1; i >= 0; i--) {
    const m = built[i];
    if (m)
      added = {
        ...m,
        ply: at + shared + i + 1,
        source,
        children: added ? [added] : [],
      };
  }
  if (!added) return { tree, path: full };
  const leaf = added;
  const next = replaceAt(tree, [...path, ...ucis.slice(0, shared)], (n) => [
    ...n.children,
    leaf,
  ]) as LineTree;
  return { tree: next, path: full };
}

/** Removes a side line's move and everything after it. The game's own moves
 * stay: deleting one returns the tree unchanged. */
export function deleteFrom(tree: LineTree, path: LinePath): LineTree {
  const node = nodeAt(tree, path);
  const uci = path.at(-1);
  if (!node || !isMove(node) || node.source === 'game' || !uci) return tree;
  return replaceAt(tree, path.slice(0, -1), (n) =>
    n.children.filter((c) => c.uci !== uci),
  ) as LineTree;
}

/** The path continued along first children to the end of its line. */
export function lineEnd(tree: LineTree, path: LinePath): string[] {
  const end = [...path];
  let next = nodeAt(tree, path)?.children[0];
  while (next) {
    end.push(next.uci);
    next = next.children[0];
  }
  return end;
}
