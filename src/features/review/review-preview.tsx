import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { moveFromUci, playUci } from '../../chess/move';
import type { CardFeedback, Deck } from '../../lib/api/practice-contract';
import type { EngineLines, GameDetail } from '../../lib/api/review-contract';
import type { LoadLines } from './review-lines';
import { ReviewLayout } from './review-screen';
import { ReviewSession } from './review-session';

// Development preview: a sample game with Chess.com-style classifications,
// graded locally, so the review runs without the backend or sign-in.
const moves =
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Bd3 O-O Be3 Nbd7 Nf3 e5 d5 c6 O-O cxd5 cxd5 Nc5 Bxc5 dxc5 Re1 Qb6 Qb3 Bg4 Qxb6 axb6 Be2 Rfd8 h3 Bd7 Nxe5 Nxe4 Nxd7 Rxd7 Nxe4 Rxd5 Bc4 Rd4 Rac1 Ra5 Rc2 b5 Bf1 c4 a3 f5 Ng3 Ra8 Re7 Rd1 Rxb7 b4 Rxb4 Re8 Rbxc4 Ree1 a4 Be5 f4 Bd6 a5 h5 Kh2 h4 Rc6 Bxf4 Bc4+ Kh7 Bg8+ Kxg8 Rxg6+ Kh7 Rcc6 Rh1#'.split(
    ' ',
  );
// Plies with a notable grade; the rest alternate best, excellent and good.
const grades: Record<number, string> = {
  26: 'mistake',
  29: 'miss',
  33: 'mistake',
  34: 'brilliant',
  36: 'miss',
  37: 'great',
  52: 'inaccuracy',
  67: 'blunder',
  68: 'great',
  69: 'mistake',
  72: 'miss',
};
const better: Record<number, string> = { 26: 'b6b3', 36: 'e4c3' };
// White's win chance after each ply, in rough strokes.
const whiteWin = (ply: number) =>
  ply < 25
    ? 52
    : ply < 33
      ? 64
      : ply < 37
        ? 40
        : ply < 66
          ? 38 - (ply - 37) / 3
          : ply < 70
            ? 20
            : 4;

function sampleGame(): GameDetail {
  const chess = new Chess();
  const plies = moves.map((san, i) => {
    const ply = i + 1;
    const before = new Chess(chess.fen());
    const move = chess.move(san);
    const color = move.color === 'w' ? ('white' as const) : ('black' as const);
    const grade =
      grades[ply] ??
      (ply <= 10 ? 'book' : ['best', 'excellent', 'good'][ply % 3]);
    const bestUci =
      better[ply] ??
      (['best', 'book', 'brilliant', 'great'].includes(grade ?? '')
        ? move.lan
        : before.moves({ verbose: true }).find((m) => m.lan !== move.lan)?.lan);
    const bestSan = bestUci ? playUci(before, bestUci).san : null;
    const white = whiteWin(ply);
    const mover = color === 'white' ? white : 100 - white;
    return {
      ply,
      color,
      san: move.san,
      uci: move.lan,
      classification: grade ?? null,
      best_san: bestSan,
      best_uci: bestUci ?? null,
      win_pct_before: mover,
      win_pct_after: mover,
      eval_after: Math.round((white - 50) * 12),
      mate_after: ply === moves.length ? -1 : null,
      // A 10+0 game: each side spends about 8 seconds a move, faster late.
      clock_left: Math.max(4.6, 600 - Math.ceil(ply / 2) * 8.3 - ply * 0.4),
    };
  });
  return {
    id: 1,
    white: 'Preview opponent',
    black: 'You',
    color: 'black',
    analysed: true,
    start_fen: null,
    san: moves,
    reviewed_at: null,
    review_marks: [],
    accuracy: 78.9,
    engine_accuracy: 78.9,
    opponent_accuracy: 72.5,
    time_control: '600',
    white_elo: 879,
    black_elo: 891,
    deck_plies: [26, 36],
    // One move still on the watch, one held twice (sample states).
    deck_cards: [
      {
        ply: 26,
        state: 'on_watch',
        due: null,
        label: 'Your move 13',
        reason: null,
        held: 0,
      },
      {
        ply: 36,
        state: 'held',
        due: '2099-01-01',
        label: 'Your move 18',
        reason: null,
        held: 2,
      },
    ],
    plies,
  };
}

const game = sampleGame();
const deck: Deck = {
  server_day: '2026-10-14',
  card: null,
  total: 2,
  mastered: 0,
  learning: 0,
  new: 2,
  today: { done: 0, total: 2 },
  results: [],
};

/** A sample grade map for a find: each wrong move is answered by a capture
 * when there is one, with a cause and its habit, as the worker prepares. */
function sampleMap(ply: number): CardFeedback {
  const before = new Chess();
  for (const san of moves.slice(0, ply - 1)) before.move(san);
  const best = game.plies[ply - 1]?.best_uci;
  const explanations: NonNullable<CardFeedback['explanations']> = {};
  for (const move of before.moves({ verbose: true })) {
    if (move.lan === best) continue;
    const after = new Chess(before.fen());
    after.move(move.lan);
    const replies = after.moves({ verbose: true });
    const reply = replies.find((m) => m.captured) ?? replies[0];
    if (!reply) continue;
    explanations[move.lan] = {
      reply_uci: reply.lan,
      reply_san: reply.san,
      reason_kind: 'eval',
      reason_text: `They answer ${reply.san}.`,
      cause: {
        cause_kind: 'missedThreat',
        cause_text: `Sample cause: ${reply.san} was there after your move.`,
        principle: 'checkReplies',
      },
    };
  }
  return { grades: {}, complete: false, explanations };
}

function createPreviewSession(loadDelay = 0) {
  return new ReviewSession(
    {
      game: async () => {
        if (loadDelay)
          await new Promise((resolve) => setTimeout(resolve, loadDelay));
        return game;
      },
      deck: async () => deck,
      answer: async ({ ply, uci }) => {
        const best = game.plies[ply - 1]?.best_uci ?? '';
        const shown = uci === '0000';
        return {
          correct: uci === best,
          quality: shown ? 'shown' : uci === best ? 'best' : 'wrong',
          rating: uci === best ? 'good' : 'again',
          best_uci: best,
          best_san: game.plies[ply - 1]?.best_san ?? '',
          due: '2026-10-15',
          mastered: false,
        };
      },
      hint: async (_id, ply) => {
        const best = game.plies[ply - 1]?.best_uci ?? '';
        return { best_uci: best, from: moveFromUci(best).from };
      },
      finishReview: async () => ({ reviewed_at: new Date().toISOString() }),
      cardFeedback: async (_id, ply) => sampleMap(ply),
    },
    game.id,
    () => true,
  );
}

// Lines: the better move then the most natural reply, and the reply that
// punishes the move played.
const loadLines: LoadLines = Object.assign(
  async (ply: number) => {
    const before = new Chess();
    for (const san of moves.slice(0, ply - 1)) before.move(san);
    const after = new Chess(before.fen());
    after.move(moves[ply - 1] ?? '');
    const best = game.plies[ply - 1]?.best_uci ?? undefined;
    const line = (start: Chess, first?: string): EngineLines['best'] => {
      const chess = new Chess(start.fen());
      const uci: string[] = [];
      for (const next of [first, undefined, undefined]) {
        const move = next
          ? playUci(chess, next)
          : (chess.moves({ verbose: true }).find((m) => m.captured) ??
            chess.moves({ verbose: true })[0]);
        if (!move) break;
        if (!next) chess.move(move.san);
        uci.push(move.lan);
      }
      return {
        start_fen: start.fen(),
        moves: uci,
        summary: 'Sample line from the preview engine.',
      };
    };
    return { best: line(before, best), why: line(after) };
  },
  { key: ['review-preview', 'engine-lines'] },
);
// The preview's own cache: no account, no backend.
const previewQueries = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

let session = createPreviewSession();
export function ReviewPreview({
  loadDelay,
}: {
  /** Holds the game this long (ms), to show the loading frame. */
  loadDelay?: number;
}) {
  const [slow] = useState(() =>
    loadDelay ? createPreviewSession(loadDelay) : undefined,
  );
  const shown = slow ?? session;
  const state = useSyncExternalStore(
    shown.subscribe,
    shown.getSnapshot,
    shown.getSnapshot,
  );
  useEffect(() => {
    void shown.load();
  }, [shown]);
  return (
    <QueryClientProvider client={previewQueries}>
      <ReviewLayout
        session={shown}
        state={state}
        loadLines={loadLines}
        // The preview has no watch to open; the button shows as it would.
        onKeepWatch={() => undefined}
        onExit={() => {
          session = createPreviewSession();
          void session.load();
          router.canGoBack() ? router.back() : router.replace('/');
        }}
      />
    </QueryClientProvider>
  );
}
