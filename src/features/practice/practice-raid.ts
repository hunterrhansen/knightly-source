import { Chess, type Square } from 'chess.js';
import { applyMove, moveFromUci, uciOf } from '../../chess/move';
import type { Raid, RaidMood } from '../../ui';
import type { PracticeSession } from './practice-session';

type PracticeState = ReturnType<PracticeSession['getSnapshot']>;
type Exercise = NonNullable<PracticeState['exercise']>;
type Raider = Raid['raiders'][number];

const pieceNames = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
} as const;

/** The moves on the board from the item's position: the line as far as it
 * is shown once answered or revealed, else the moves the server accepted
 * (and a right move whose reply is on its way). A miss knows the line too,
 * but it is not on the board. */
function movesOf(e: Exercise, phase: PracticeState['phase']) {
  const shown =
    e.line && (phase === 'answered' || phase === 'revealing')
      ? e.line.uci.slice(0, e.view ?? e.line.uci.length)
      : [];
  const played =
    phase === 'replying' && e.attempt
      ? [...e.played, uciOf(e.attempt)]
      : e.played;
  return shown.length > played.length ? shown : played;
}

/** The item's identity: the position keeps its raiders through its moves. */
const keyOf = (e: Exercise) => {
  const item = e.item;
  return item.kind === 'puzzle'
    ? `puzzle:${item.id}`
    : `${item.kind}:${item.game_id}:${item.ply}`;
};

/** How the raiders react in `phase`: back into the trees after a right
 * answer, forward after a wrong one, waiting otherwise (a rewind resets). */
function moodOf(e: Exercise, phase: PracticeState['phase']): RaidMood {
  if (phase === 'wrong' || phase === 'refuting') return 'edgeIn';
  if (phase === 'threat-shown')
    return e.threat?.correct ? 'fallBack' : 'edgeIn';
  if (phase === 'replying') return 'fallBack';
  if (
    phase === 'answered' &&
    e.quality !== 'shown' &&
    e.quality !== undefined &&
    e.quality !== 'wrong'
  )
    return 'fallBack';
  return 'lurk';
}

/**
 * The opponent's pieces of the exercise's position as raiders at the
 * treeline (docs/specs/2026-10-18-watch-story-design.md, "During the watch:
 * looking out from the wall"), placed by file and rank as the board shows
 * them (`orientation` is its bottom side). A piece the learner captures is
 * out. On a multi-move line whose threat is known (a card's "What do they
 * threaten?"), the piece that starts it is the raid captain, with one health
 * segment per learner move of the line; each right move cracks one and a
 * wrong move takes none.
 */
export function raidOf(
  e: Exercise,
  phase: PracticeState['phase'],
  orientation: 'w' | 'b',
): Raid | undefined {
  const item = e.item;
  let fen = item.fen_before;
  const learner = item.color === 'white' ? 'w' : 'b';
  let board: ReturnType<Chess['board']>;
  try {
    board = new Chess(fen).board();
  } catch {
    return undefined;
  }
  // By the square each piece started on, so a raider keeps its identity
  // as it moves.
  const pieces = new Map<
    string,
    { kind: Raider['kind']; square: string; out: boolean }
  >();
  for (const row of board)
    for (const cell of row)
      if (cell && cell.color !== learner)
        pieces.set(cell.square, {
          kind: cell.type,
          square: cell.square,
          out: false,
        });
  const at = (square: string) =>
    [...pieces.values()].find((p) => !p.out && p.square === square);
  const moves = movesOf(e, phase);
  for (const [index, uci] of moves.entries()) {
    let applied: ReturnType<typeof applyMove>;
    try {
      applied = applyMove(fen, moveFromUci(uci));
    } catch {
      break;
    }
    // The learner's moves are the even ones from the item's position.
    if (index % 2 === 0 && applied.capturedSquare) {
      const taken = at(applied.capturedSquare);
      if (taken) taken.out = true;
    }
    for (const motion of applied.motions) {
      if (motion.color === learner) continue;
      const piece = at(motion.from);
      if (!piece) continue;
      piece.square = motion.to;
      if (motion.promotedTo) piece.kind = motion.promotedTo;
    }
    fen = applied.fen;
  }
  const raiders = [...pieces.entries()].map(([id, p]): Raider => {
    const file = p.square.charCodeAt(0) - 97;
    const rank = Number(p.square[1]);
    return {
      id,
      kind: p.kind,
      file: orientation === 'w' ? file : 7 - file,
      depth: orientation === 'w' ? 8 - rank : rank - 1,
      out: p.out,
    };
  });
  return {
    key: keyOf(e),
    raiders,
    mood: moodOf(e, phase),
    named: namedOf(e),
    captain: captainOf(e, phase, pieces),
  };
}

/** Whose pieces these are, for the plaque. */
const ownerOf = (opponent: string | null | undefined) =>
  opponent ? `${opponent}’s` : 'Their';

/** The game's piece the plaque names ("kd_88's bishop"): always the one whose
 * move led here, never the threat's, so the plaque gives no hint of the
 * answer. Only a position from the learner's own games has one. */
function namedOf(e: Exercise) {
  const item = e.item;
  if (item.kind !== 'card') return undefined;
  const square = item.prev_uci?.slice(2, 4);
  if (!square) return undefined;
  let piece: ReturnType<Chess['get']>;
  try {
    piece = new Chess(item.fen_before).get(square as Square);
  } catch {
    return undefined;
  }
  const learner = item.color === 'white' ? 'w' : 'b';
  if (!piece || piece.color === learner) return undefined;
  return `${ownerOf(item.opponent)} ${pieceNames[piece.type]}`;
}

function captainOf(
  e: Exercise,
  phase: PracticeState['phase'],
  pieces: ReadonlyMap<string, { kind: Raider['kind'] }>,
): Raid['captain'] {
  const item = e.item;
  if (item.kind !== 'card') return undefined;
  const threat = item.threat?.threats[0]?.uci;
  const line = item.line ?? e.solution;
  if (!threat || !line) return undefined;
  const segments = Math.ceil(line.length / 2);
  const id = threat.slice(0, 2);
  const piece = pieces.get(id);
  if (segments < 2 || !piece) return undefined;
  // Learner moves the server accepted; a finished right answer lands them all.
  const landed = Math.ceil(
    (e.played.length + (phase === 'replying' && e.attempt ? 1 : 0)) / 2,
  );
  const cracked =
    phase === 'answered' && moodOf(e, phase) === 'fallBack'
      ? segments
      : Math.min(landed, segments);
  return {
    id,
    name: `${ownerOf(item.opponent)} ${pieceNames[piece.kind]}`,
    segments,
    cracked,
  };
}
