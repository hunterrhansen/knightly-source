import type { PieceSymbol } from 'chess.js';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GradeBadge, type MoveGrade, PieceFigurine } from '../../chess/board';
import {
  type LineNode,
  type LinePath,
  type LineTree,
  lineEnd,
  nodeAt,
  pathKey,
} from '../../chess/line-tree';
import type { GameDetail } from '../../lib/api/review-contract';
import { createStyles, useTheme } from '../../theme/theme';
import { ActionBar, ActionButton, IconButton } from '../../ui';
import { gradeOf } from './review-moments';

type Move = { index: number; number: number; san: string; grade?: MoveGrade };
// Badges only on moves worth a look, as on Chess.com's move list.
const badged = new Set<MoveGrade>([
  'brilliant',
  'great',
  'best',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
]);
function movesOf(game: GameDetail, first: 'w' | 'b'): Move[] {
  return game.san.map((san, i) => {
    const grade = game.analysed ? gradeOf(game.plies[i]) : undefined;
    const offset = first === 'b' ? 1 : 0;
    return {
      index: i + 1,
      number: Math.floor((i + offset) / 2) + 1,
      san,
      grade: grade && badged.has(grade) ? grade : undefined,
    };
  });
}
const firstMover = (game: GameDetail) =>
  game.start_fen?.split(' ')[1] === 'b' ? 'b' : 'w';
const label = (m: Move, first: 'w' | 'b') =>
  `${m.number}${(m.index % 2 === 1) === (first === 'w') ? '.' : '…'} ${m.san}`;

function Cell({
  move,
  selected,
  onSelect,
  first,
}: {
  move: Move;
  selected: boolean;
  onSelect: (index: number) => void;
  first: 'w' | 'b';
}) {
  const styles = useStyles();
  const white = (move.index % 2 === 1) === (first === 'w');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label(move, first)}${move.grade ? `, ${move.grade}` : ''}`}
      accessibilityState={{ selected }}
      onPress={() => onSelect(move.index)}
      style={[styles.cell, selected && styles.selected]}
    >
      {move.grade && <GradeBadge grade={move.grade} size={18} />}
      <Notation san={move.san} white={white} />
    </Pressable>
  );
}
/** "Nf3" reads as the knight's silhouette then "f3", as Chess.com's list. */
function Notation({ san, white }: { san: string; white: boolean }) {
  const styles = useStyles();
  const { theme } = useTheme();
  const letter = /^[KQRBN]/.exec(san)?.[0];
  const piece = letter?.toLowerCase() as PieceSymbol | undefined;
  return (
    <View style={styles.notation}>
      {piece && (
        <PieceFigurine
          kind={piece}
          color={white ? 'w' : 'b'}
          size={18}
          ink={theme.colors.ink}
        />
      )}
      <Text style={styles.san}>{piece ? san.slice(1) : san}</Text>
    </View>
  );
}

/** What the move list does with side lines: open one at a move, and ask to
 * delete one from a move (long-press). */
export type LineActions = {
  tree?: LineTree;
  /** The side line on the board, if any. */
  path?: LinePath;
  onOpen: (path: LinePath) => void;
  onDelete: (path: LinePath) => void;
};
type LineItem = { path: string[]; node: LineNode; number?: string };
/** A side line's move: tap shows it, long-press offers Delete from here. */
function LineCell({
  item,
  selected,
  actions,
  chip = false,
}: {
  item: LineItem;
  selected: boolean;
  actions: LineActions;
  /** A branch from the game in the strip, outlined. */
  chip?: boolean;
}) {
  const styles = useStyles();
  const white = item.node.fen.split(' ')[1] === 'b';
  return (
    <View style={styles.stripItem}>
      {item.number && <Text style={styles.number}>{item.number}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Side line, ${item.number ? `${item.number} ` : ''}${item.node.san}`}
        accessibilityHint="Long-press to delete from here"
        accessibilityState={{ selected }}
        onPress={() => actions.onOpen(item.path)}
        onLongPress={() => actions.onDelete(item.path)}
        style={[styles.cell, chip && styles.chip, selected && styles.selected]}
      >
        <Notation san={item.node.san} white={white} />
      </Pressable>
    </View>
  );
}
/** A line's moves from a node on, split where it branches again: the moves
 * up to each branch, then each branch one level in (at most two), then the
 * rest. Every block starts with its move number. */
function lineBlocks(
  parent: LinePath,
  first: LineNode,
  depth: number,
): { depth: number; items: LineItem[] }[] {
  const blocks: { depth: number; items: LineItem[] }[] = [];
  let items: LineItem[] = [];
  let node: LineNode | undefined = first;
  let path = [...parent, first.uci];
  while (node) {
    items.push({ path, node, number: numberFor(node, items.length === 0) });
    const branches = node.children.slice(1);
    if (branches.length) {
      blocks.push({ depth, items });
      items = [];
      for (const branch of branches)
        blocks.push(...lineBlocks(path, branch, Math.min(depth + 1, 2)));
    }
    const next: LineNode | undefined = node.children[0];
    if (next) path = [...path, next.uci];
    node = next;
  }
  if (items.length) blocks.push({ depth, items });
  return blocks;
}
/** "5." before White's moves, "5…" before Black's when a block opens on it. */
function numberFor(node: LineNode, opening: boolean) {
  const [, turn, , , , number] = node.fen.split(' ');
  // The FEN is after the move: Black to move means White just moved.
  if (turn === 'b') return `${number}.`;
  return opening ? `${Number(number) - 1}…` : undefined;
}
/** The side lines leaving the game after each of its positions, by ply. */
function gameBranches(tree: LineTree | undefined) {
  const branches = new Map<number, LineItem[]>();
  let node: LineTree | LineNode | undefined = tree;
  const path: string[] = [];
  let ply = 0;
  while (node) {
    const at = [...path];
    const others = node.children.slice(1);
    if (others.length)
      branches.set(
        ply,
        others.map((c) => ({
          path: [...at, c.uci],
          node: c,
          number: numberFor(c, true),
        })),
      );
    const next: LineNode | undefined = node.children[0];
    if (next?.source !== 'game') break;
    path.push(next.uci);
    node = next;
    ply++;
  }
  return branches;
}

function MoveArrow({
  delta,
  current,
  last,
  onSelect,
}: {
  delta: -1 | 1;
  current: number;
  last: number;
  onSelect: (index: number) => void;
}) {
  return (
    <IconButton
      icon={delta < 0 ? 'previous' : 'next'}
      iconSize={28}
      accessibilityLabel={delta < 0 ? 'Previous move' : 'Next move'}
      disabled={delta < 0 ? current <= 0 : current >= last}
      onPress={() => onSelect(current + delta)}
    />
  );
}

/** Back and Forward one move, under the wide layout's move list. */
export function MoveArrows({
  game,
  current,
  onSelect,
}: {
  game: GameDetail;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ActionBar>
      <ActionButton
        icon="previous"
        label="Back"
        accessibilityLabel="Previous move"
        disabled={current <= 0}
        onPress={() => onSelect(current - 1)}
      />
      <ActionButton
        icon="next"
        label="Forward"
        accessibilityLabel="Next move"
        disabled={current >= game.san.length}
        onPress={() => onSelect(current + 1)}
      />
    </ActionBar>
  );
}

/** ‹, the moves around the current one, ›: step one move at a time. */
export function MoveStepper({
  game,
  current,
  onSelect,
  lines,
}: {
  game: GameDetail;
  current: number;
  onSelect: (index: number) => void;
  /** Side lines show as outlined chips after the game move they replace. */
  lines?: LineActions;
}) {
  const styles = useStyles();
  const first = firstMover(game);
  const moves = movesOf(game, first);
  const branches = gameBranches(lines?.tree);
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<number, number>());
  useEffect(() => {
    const x = offsets.current.get(current);
    if (x !== undefined)
      scroll.current?.scrollTo({ x: Math.max(0, x - 96), animated: true });
  }, [current]);
  return (
    <View style={styles.stepper}>
      <MoveArrow
        delta={-1}
        current={current}
        last={moves.length}
        onSelect={onSelect}
      />
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {moves.map((m) => (
          <View
            key={m.index}
            onLayout={(e) => {
              offsets.current.set(m.index, e.nativeEvent.layout.x);
              if (m.index === current)
                scroll.current?.scrollTo({
                  x: Math.max(0, e.nativeEvent.layout.x - 96),
                  animated: false,
                });
            }}
            style={styles.stripItem}
          >
            {(m.index % 2 === 1) === (first === 'w') && (
              <Text style={styles.number}>{m.number}.</Text>
            )}
            <Cell
              move={m}
              first={first}
              selected={m.index === current}
              onSelect={onSelect}
            />
            {lines &&
              branches
                .get(m.index - 1)
                ?.map((b) => (
                  <LineCell
                    key={pathKey(b.path)}
                    item={b}
                    chip
                    selected={false}
                    actions={lines}
                  />
                ))}
          </View>
        ))}
      </ScrollView>
      <MoveArrow
        delta={1}
        current={current}
        last={moves.length}
        onSelect={onSelect}
      />
    </View>
  );
}

/** Every move in numbered rows, White then Black, as Chess.com's review
 * panel: the wide layout's list, kept scrolled to the current move. */
export function MoveTable({
  game,
  current,
  onSelect,
  lines,
}: {
  game: GameDetail;
  current: number;
  onSelect: (index: number) => void;
  /** Side lines split the table under the game move they replace. */
  lines?: LineActions;
}) {
  const styles = useStyles();
  const first = firstMover(game);
  const moves = movesOf(game, first);
  const branches = gameBranches(lines?.tree);
  type Row = {
    key: string;
    number: number;
    white?: Move;
    black?: Move;
    /** "…" in a column already played, around a split. */
    gap?: 'white' | 'black';
    blocks?: { depth: number; items: LineItem[] }[];
  };
  const rows: Row[] = [];
  const blocksAfter = (ply: number) =>
    (branches.get(ply) ?? []).flatMap((b) =>
      lineBlocks(b.path.slice(0, -1), b.node, 0),
    );
  for (const m of moves) {
    const row = rows.at(-1);
    const white = (m.index % 2 === 1) === (first === 'w');
    if (white) rows.push({ key: `m${m.index}`, number: m.number, white: m });
    // Black's move ends White's row, or opens a game that Black starts.
    else if (row?.number === m.number && !row.blocks) row.black = m;
    else
      rows.push({
        key: `m${m.index}`,
        number: m.number,
        black: m,
        gap: 'white',
      });
    // As Chess.com's: the row splits under a move that has side lines.
    const blocks = blocksAfter(m.index - 1);
    if (blocks.length) {
      const at = rows.at(-1);
      if (at && white) at.gap = 'black';
      rows.push({ key: `l${m.index}`, number: m.number, blocks });
    }
  }
  // Lines after the last move (none of the game's to replace).
  const tail = blocksAfter(moves.length);
  if (tail.length)
    rows.push({ key: 'l-end', number: moves.length + 1, blocks: tail });
  const shown = lines?.path ? pathKey(lines.path) : undefined;
  const scroll = useRef<ScrollView>(null);
  const tops = useRef(new Map<number, number>());
  const height = useRef(0);
  const row = (index: number) =>
    first === 'w' ? Math.ceil(index / 2) : Math.floor(index / 2) + 1;
  // The current row stays a row below the top, so the moves before it show.
  const reveal = (animated: boolean) => {
    const y = tops.current.get(row(current));
    if (y !== undefined)
      scroll.current?.scrollTo({
        y: Math.max(0, y - Math.min(96, height.current / 3)),
        animated,
      });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the current move only
  useEffect(() => reveal(true), [current]);
  return (
    <ScrollView
      ref={scroll}
      style={styles.table}
      onLayout={(e) => {
        height.current = e.nativeEvent.layout.height;
      }}
    >
      {rows.map((r) =>
        r.blocks ? (
          <View key={r.key} style={styles.lines}>
            {r.blocks.map((b) => (
              <View
                key={pathKey(b.items[0]?.path ?? [])}
                style={[styles.lineBlock, { marginLeft: 24 + b.depth * 20 }]}
              >
                {lines &&
                  b.items.map((item) => (
                    <LineCell
                      key={pathKey(item.path)}
                      item={item}
                      selected={pathKey(item.path) === shown}
                      actions={lines}
                    />
                  ))}
              </View>
            ))}
          </View>
        ) : (
          <View
            key={r.key}
            style={[styles.row, r.number % 2 === 0 && styles.rowAlt]}
            onLayout={(e) => {
              if (!r.gap || r.gap === 'black' || !tops.current.has(r.number))
                tops.current.set(r.number, e.nativeEvent.layout.y);
              if (r.number === row(current)) reveal(false);
            }}
          >
            <Text style={[styles.number, styles.rowNumber]}>{r.number}.</Text>
            {[r.white, r.black].map((m, side) => (
              <View key={side === 0 ? 'w' : 'b'} style={styles.rowCell}>
                {m ? (
                  <Cell
                    move={m}
                    first={first}
                    selected={!shown && m.index === current}
                    onSelect={onSelect}
                  />
                ) : (
                  r.gap === (side === 0 ? 'white' : 'black') && (
                    <Text style={[styles.san, styles.gap]}>…</Text>
                  )
                )}
              </View>
            ))}
          </View>
        ),
      )}
    </ScrollView>
  );
}

/** The phone's strip on a side line: its moves from where it left the game
 * to its end, the one on the board highlighted, other branches as chips. */
export function LineStrip({
  tree,
  path,
  start,
  actions,
}: {
  tree: LineTree;
  path: LinePath;
  start: number;
  actions: LineActions;
}) {
  const styles = useStyles();
  const end = lineEnd(tree, path);
  const items: (LineItem & { chip?: boolean })[] = [];
  for (let i = start; i < end.length; i++) {
    const at = end.slice(0, i + 1);
    const node = nodeAt(tree, at);
    if (!node || !('uci' in node)) continue;
    items.push({ path: at, node, number: numberFor(node, i === start) });
    const parent = nodeAt(tree, end.slice(0, i));
    for (const other of parent?.children ?? [])
      if (other.uci !== node.uci && i > start)
        items.push({
          path: [...end.slice(0, i), other.uci],
          node: other,
          number: numberFor(other, true),
          chip: true,
        });
  }
  const shown = pathKey(path);
  const scroll = useRef<ScrollView>(null);
  return (
    <View style={styles.stepper}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        onContentSizeChange={(width) => scroll.current?.scrollTo({ x: width })}
      >
        {items.map((item) => (
          <LineCell
            key={`${item.chip ? 'chip' : 'line'}:${pathKey(item.path)}`}
            item={item}
            chip={item.chip}
            selected={pathKey(item.path) === shown}
            actions={actions}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** Delete from here, confirmed in the strip's place so nothing moves. */
export function DeleteLine({
  label,
  onDelete,
  onCancel,
}: {
  label: string;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.stepper, styles.confirm]}>
      <Text style={styles.confirmText} numberOfLines={1}>
        Delete from {label}?
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.cell}
      >
        <Text style={styles.san}>Cancel</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onDelete}
        style={[styles.cell, styles.danger]}
      >
        <Text style={styles.san}>Delete</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderStyle: 'dashed',
  },
  lines: { paddingVertical: 2, gap: 2 },
  lineBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.line,
    paddingLeft: theme.spacing.xs,
  },
  gap: { color: theme.colors.inkMuted, paddingHorizontal: theme.spacing.sm },
  confirm: { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm },
  confirmText: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
  danger: { borderWidth: 2, borderColor: theme.colors.dangerText },
  stepper: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  strip: { alignItems: 'center', gap: 2, paddingHorizontal: theme.spacing.xs },
  stripItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  number: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    marginLeft: theme.spacing.xs,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 10,
  },
  selected: {
    backgroundColor: 'rgba(73, 168, 242, 0.18)',
    borderWidth: 2,
    borderColor: theme.colors.sky,
  },
  table: { flex: 1, minHeight: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    borderRadius: 8,
  },
  rowAlt: { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  rowNumber: { width: 40, marginLeft: theme.spacing.xs },
  rowCell: { flex: 1, alignItems: 'flex-start' },
  notation: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  san: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
}));
