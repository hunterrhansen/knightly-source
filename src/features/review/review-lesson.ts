import { Chess } from 'chess.js';
import { playUci } from '../../chess/move';
import type { GameDetail } from '../../lib/api/review-contract';

export type Replay = { positions: string[]; labels: string[]; error?: string };
export function replayGame(
  game: Pick<GameDetail, 'san' | 'start_fen'>,
): Replay {
  const chess = new Chess(game.start_fen ?? undefined);
  const replay: Replay = {
    positions: [chess.fen()],
    labels: ['Starting position'],
  };
  for (const san of game.san) {
    try {
      const turn = chess.turn();
      const number = chess.fen().split(' ')[5];
      const move = chess.move(san);
      replay.positions.push(chess.fen());
      replay.labels.push(`${number}${turn === 'w' ? '.' : '…'} ${move.san}`);
    } catch {
      replay.error = `Could not read move ${replay.positions.length} (${san}). Showing the last valid position.`;
      break;
    }
  }
  return replay;
}
export type ReviewStep = {
  ply: number;
  type: 'find' | 'look' | 'praise';
  title: string;
  fen: string;
};
const sound = (kind: string | null) =>
  kind == null ||
  ['brilliant', 'great', 'best', 'excellent', 'good'].includes(kind);
export function buildLesson(
  game: GameDetail,
  replay: Replay,
): { steps: ReviewStep[]; blocked?: string } {
  const block = (blocked: string) => ({ steps: [], blocked });
  if (!game.analysed)
    return block('Analysis is not ready. You can replay the recorded game.');
  if (!game.color) return block('Your side is unknown. Replay is available.');
  if (replay.error || game.plies.length !== game.san.length)
    return block(
      'Analysis does not match the recorded game. Replay is available.',
    );
  const board = new Chess(game.start_fen ?? undefined);
  for (let i = 0; i < game.plies.length; i++) {
    const m = game.plies[i];
    const san = game.san[i];
    if (!m || !san)
      return block('Analysis is incomplete. Replay is available.');
    const played = board.move(san);
    if (
      m.ply !== i + 1 ||
      m.san !== played.san ||
      m.color !== (played.color === 'w' ? 'white' : 'black') ||
      m.uci !== played.lan
    )
      return block(
        'Analysis does not match the recorded game. Replay is available.',
      );
  }
  const moments = new Map<number, string>();
  // Their large mistake becomes one lesson at your reply, never a duplicate step.
  for (let i = 0; i < game.plies.length - 1; i++) {
    const m = game.plies[i],
      reply = game.plies[i + 1];
    if (
      m &&
      reply &&
      m.color !== game.color &&
      m.win_pct_before !== null &&
      m.win_pct_after !== null &&
      m.win_pct_before - m.win_pct_after >= 20
    ) {
      moments.set(
        reply.ply,
        sound(reply.classification)
          ? 'You punished their mistake'
          : 'You missed their mistake',
      );
    }
  }
  for (const m of game.plies) {
    if (
      m.color === game.color &&
      ['brilliant', 'great', 'mistake', 'blunder', 'miss'].includes(
        m.classification ?? '',
      ) &&
      !moments.has(m.ply)
    )
      moments.set(
        m.ply,
        m.classification === 'brilliant'
          ? 'Brilliant move'
          : m.classification === 'great'
            ? 'Great move'
            : 'Find a better move',
      );
  }
  const steps: ReviewStep[] = [];
  for (const [ply, title] of [...moments].sort(([a], [b]) => a - b)) {
    const m = game.plies[ply - 1];
    if (!m) return block('Analysis is incomplete. Replay is available.');
    const type = sound(m.classification)
      ? 'praise'
      : game.deck_plies.includes(ply)
        ? 'find'
        : 'look';
    const fen = replay.positions[type === 'find' ? ply - 1 : ply];
    if (!fen) return block('Analysis is incomplete. Replay is available.');
    steps.push({ ply, type, title, fen });
  }
  if (steps.length > 200)
    return block(
      'Too many key moments for a saved lesson. Replay is available.',
    );
  for (const step of steps) {
    if (step.type !== 'find') continue;
    const best = game.plies[step.ply - 1]?.best_uci;
    if (!best) return block('A lesson answer is missing. Replay is available.');
    try {
      playUci(new Chess(step.fen), best);
    } catch {
      return block('A lesson answer is invalid. Replay is available.');
    }
  }
  return { steps };
}
