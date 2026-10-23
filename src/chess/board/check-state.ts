import { Chess, type Square } from 'chess.js';

export function checkState(fen: string) {
  try {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return undefined;
    const loser = chess.turn();
    const enemy = loser === 'w' ? 'b' : 'w';
    const king = chess.findPiece({ type: 'k', color: loser })[0];
    if (!king) return undefined;
    const path: Square[] = [];
    for (const from of chess.attackers(king, enemy)) {
      const df = king.charCodeAt(0) - from.charCodeAt(0);
      const dr = Number(king[1]) - Number(from[1]);
      if (df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr)) {
        for (let s = 0; s < Math.max(Math.abs(df), Math.abs(dr)); s++)
          path.push(
            `${String.fromCharCode(from.charCodeAt(0) + Math.sign(df) * s)}${Number(from[1]) + Math.sign(dr) * s}` as Square,
          );
      } else path.push(from);
    }
    return {
      king,
      path: [...new Set(path)],
      loser,
      mate: chess.isCheckmate(),
      winner: chess.findPiece({ type: 'k', color: enemy })[0],
    };
  } catch {
    return undefined;
  }
}
