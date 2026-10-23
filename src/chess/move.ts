import { Chess, type Move, type Square } from 'chess.js';
import type { MoveVariant, PieceMotion, Promotion } from './board/board.types';
import { pieceNames } from './position';

type AppliedMove = Readonly<{
  fen: string;
  motions: readonly PieceMotion[];
  capturedSquare?: Square;
}>;

/** A UCI move such as `e7e8q` as the board's move. */
export function moveFromUci(uci: string): MoveVariant {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    ...(uci[4] ? { promotion: uci[4] as Promotion } : {}),
  };
}

/** The board's move as a UCI string, such as `e7e8q`. */
export function uciOf(move: MoveVariant): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/** Plays a UCI move on `board`. Throws, as chess.js does, if it is illegal. */
export function playUci(board: Chess, uci: string): Move {
  return board.move(moveFromUci(uci));
}

function chessFor(fen: string): Chess {
  try {
    return new Chess(fen);
  } catch {
    throw new Error('Invalid chess position');
  }
}
function variant(move: Move): MoveVariant {
  return {
    from: move.from,
    to: move.to,
    ...(move.promotion
      ? { promotion: move.promotion as MoveVariant['promotion'] }
      : {}),
  };
}
export function legalMoves(fen: string): readonly MoveVariant[] {
  return chessFor(fen).moves({ verbose: true }).map(variant);
}
function validatedMove(chess: Chess, input: MoveVariant): Move {
  const legal = chess
    .moves({ verbose: true })
    .find(
      (move) =>
        move.from === input.from &&
        move.to === input.to &&
        move.promotion === input.promotion,
    );
  if (!legal) throw new Error('Illegal move: supply a complete legal variant');
  return legal;
}
function capturedSquare(move: Move): Square | undefined {
  if (!move.captured) return undefined;
  return move.isEnPassant()
    ? (`${move.to[0]}${move.from[1]}` as Square)
    : move.to;
}
export function applyMove(fen: string, input: MoveVariant): AppliedMove {
  const chess = chessFor(fen);
  const move = validatedMove(chess, input);
  const motions: PieceMotion[] = [
    {
      from: move.from,
      to: move.to,
      color: move.color,
      kind: move.piece,
      ...(move.promotion
        ? { promotedTo: move.promotion as MoveVariant['promotion'] }
        : {}),
    },
  ];
  if (move.isKingsideCastle() || move.isQueensideCastle()) {
    const rank = move.color === 'w' ? '1' : '8';
    const kingside = move.isKingsideCastle();
    motions.push({
      from: `${kingside ? 'h' : 'a'}${rank}` as Square,
      to: `${kingside ? 'f' : 'd'}${rank}` as Square,
      color: move.color,
      kind: 'r',
    });
  }
  const captured = capturedSquare(move);
  chess.move(input);
  return {
    fen: chess.fen(),
    motions,
    ...(captured ? { capturedSquare: captured } : {}),
  };
}
export function describeMove(fen: string, input: MoveVariant): string {
  const move = validatedMove(chessFor(fen), input);
  const side = move.color === 'w' ? 'White' : 'Black';
  if (move.isKingsideCastle()) return `${side} castles kingside`;
  if (move.isQueensideCastle()) return `${side} castles queenside`;
  let description = `${side} ${pieceNames[move.piece]} from ${move.from} to ${move.to}`;
  if (move.captured) {
    description += `, captures ${move.color === 'w' ? 'black' : 'white'} ${pieceNames[move.captured]} on ${capturedSquare(move)}`;
    if (move.isEnPassant()) description += ' en passant';
  }
  if (move.promotion)
    description += `, promotes to ${pieceNames[move.promotion]}`;
  return description;
}

/**
 * Dropping a king on its own home-rank rook means castling toward that rook,
 * as on common chess sites. Returns the king's castling square, if any.
 */
export function castlingDropTarget(
  fen: string,
  from: Square,
  to: Square,
): Square | undefined {
  let chess: Chess;
  try {
    chess = new Chess(fen, { skipValidation: true });
  } catch {
    return undefined;
  }
  const king = chess.get(from);
  const rook = chess.get(to);
  const rank = king?.color === 'w' ? '1' : '8';
  if (
    king?.type !== 'k' ||
    rook?.type !== 'r' ||
    rook.color !== king.color ||
    from !== `e${rank}` ||
    to[1] !== rank
  )
    return undefined;
  if (to[0] === 'h') return `g${rank}` as Square;
  if (to[0] === 'a') return `c${rank}` as Square;
  return undefined;
}
/** `fen` with the side to move passing: the other side to move and no en passant.
 * The position "if you passed", to ask what the opponent threatens. */
export function passedFen(fen: string): string {
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  return parts.join(' ');
}
