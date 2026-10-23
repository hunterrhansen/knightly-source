import { Chess } from 'chess.js';
import { useState, useSyncExternalStore } from 'react';
import { moveFromUci, playUci } from '../../chess/move';
import type {
  Deck,
  PracticeCard,
  PracticeStep,
} from '../../lib/api/practice-contract';
import type { ThreatItem } from '../../lib/api/threat-contract';
import { PracticeLayout } from './practice-screen';
import { PracticeSession } from './practice-session';
import type { QuestionKind } from './threat-copy';

// Development preview: three labeled sample positions and a three-move sample
// puzzle, graded locally, so the screen runs without the backend or sign-in.
type Sample = Omit<PracticeCard, 'line_key'> & { best: string };
const previewSamples: Sample[] = [
  {
    game_id: 1,
    ply: 7,
    reviews: 0,
    fen_prev:
      'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    prev_uci: 'g8f6',
    fen_before:
      'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    color: 'white',
    san: 'd3',
    uci: 'd2d3',
    move_number: 4,
    classification: 'miss',
    opponent: 'Preview sample',
    pattern: 'mate',
    best: 'h5f7',
  },
  {
    game_id: 2,
    ply: 11,
    reviews: 0,
    fen_prev:
      'r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 5',
    prev_uci: 'f6d5',
    fen_before:
      'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6',
    color: 'white',
    san: 'O-O',
    uci: 'e1g1',
    move_number: 6,
    classification: 'miss',
    opponent: 'Preview sample',
    pattern: 'fork',
    best: 'g5f7',
  },
  {
    game_id: 3,
    ply: 4,
    reviews: 0,
    fen_prev: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
    prev_uci: 'g2g4',
    fen_before: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    color: 'black',
    san: 'Nc6',
    uci: 'b8c6',
    move_number: 2,
    classification: 'miss',
    opponent: 'Preview sample',
    pattern: 'mate',
    best: 'd8h4',
    // Coaching as the worker prepares it: a reason for a likely wrong move
    // (played in before the verdict) and the solution's why.
    feedback: {
      grades: {},
      complete: false,
      explanations: {
        g8f6: {
          reply_uci: 'g4g5',
          reply_san: 'g5',
          reason_kind: 'missed' as const,
          reason_text:
            'Safe, but there’s a stronger move here. Look for a way to give mate.',
        },
        // A cause: why the move was missed, and the habit it points to.
        f8a3: {
          reply_uci: 'b2a3',
          reply_san: 'bxa3',
          reason_kind: 'material' as const,
          reason_text: 'That drops your bishop to bxa3.',
          cause: {
            cause_kind: 'loosePiece' as const,
            cause_text:
              'Your bishop on a3 can be taken by a pawn, so bxa3 wins it.',
            principle: 'loosePieces' as const,
          },
        },
      },
      why: { why_kind: 'mate' as const, why_text: 'Checkmate.' },
      candidates: [
        {
          uci: 'd8h4',
          san: 'Qh4#',
          line: ['d8h4'],
          score_cp: 100000,
          mate: 1,
          reason_kind: 'mate',
          reason_text: 'Checkmate.',
          about_equal: false,
        },
        {
          uci: 'd7d5',
          san: 'd5',
          line: ['d7d5', 'e2e3', 'b8c6'],
          score_cp: 60,
          mate: null,
          reason_kind: 'eval',
          reason_text: 'Keeps it level (+0.6).',
          about_equal: false,
        },
        {
          uci: 'b8c6',
          san: 'Nc6',
          line: ['b8c6', 'e2e3', 'd7d5'],
          score_cp: 40,
          mate: null,
          reason_kind: 'eval',
          reason_text: 'About as good as d5.',
          about_equal: true,
        },
      ],
    },
  },
];

// From the wall only: a card whose threat is known and whose answer is a
// two-move line, so the rook that starts the threat leads the raid as its
// captain (and is knocked out by the second move).
const raidSample: Sample = {
  game_id: 4,
  ply: 31,
  reviews: 0,
  fen_before: 'r4r1k/6pp/8/6N1/2Q5/8/6PP/6K1 w - - 1 16',
  color: 'white',
  san: 'Qc3',
  uci: 'c4c3',
  move_number: 16,
  classification: 'miss',
  opponent: 'Preview sample',
  pattern: 'fork',
  best: 'g5f7',
  line: ['g5f7', 'f8f7', 'c4f7'],
  threat: {
    threats: [{ uci: 'f8f2', san: 'Rf2', line: ['f8f2'], net: 1, mate: null }],
  },
};

// A Lichess-style puzzle: the setup move, then a three-move line.
const puzzle = {
  id: 'preview1',
  fen_prev: 'r4rk1/6pp/8/6N1/2Q5/8/6PP/6K1 b - - 0 1',
  prev_uci: 'g8h8',
  fen_before: 'r4r1k/6pp/8/6N1/2Q5/8/6PP/6K1 w - - 1 2',
  color: 'white' as const,
  themes: ['fork'],
  rating: 1350,
  line_key: '0000000000000001',
  line: ['g5f7', 'f8f7', 'c4f7'],
};

const sanOf = (fen: string, line: readonly string[]) => {
  const chess = new Chess(fen);
  return line.map((uci) => playUci(chess, uci).san);
};

/** Grades a move list against a sample line, as the server does. */
function grade(
  fen: string,
  line: readonly string[],
  moves: readonly string[],
): PracticeStep {
  const index = moves.length - 1;
  const uci = moves[index] ?? '';
  const san = sanOf(fen, line);
  const expected = line[index] ?? '';
  const status =
    uci === '0000' ? 'shown' : uci === expected ? 'solved' : 'failed';
  const reply = line[index + 1];
  if (status === 'solved' && reply)
    return {
      status: 'continue',
      step: index / 2,
      reply_uci: reply,
      reply_san: san[index + 1] ?? '',
    };
  return {
    status,
    step: index / 2,
    correct: status === 'solved',
    quality:
      status === 'shown' ? 'shown' : status === 'solved' ? 'best' : 'wrong',
    rating: status === 'solved' ? 'good' : 'again',
    best_uci: expected,
    best_san: san[index] ?? '',
    line: { uci: [...line], san },
    due: '2026-10-15',
    mastered: false,
  };
}

// A threat question of each kind, asked before the sample positions.
const questionBase = {
  game_id: 90,
  ply: 9,
  color: 'white' as const,
  fen_prev: null,
  prev_uci: null,
  opponent: 'Preview sample',
  played_at: null,
  best_san: null,
  grades: null,
};
const questionSamples: Record<QuestionKind, ThreatItem> = {
  threat: {
    ...questionBase,
    kind: 'threat',
    fen_before: '4k3/8/8/3p4/4N3/8/5PPP/6K1 w - - 0 1',
    played_san: 'Kf1',
    threats: [{ uci: 'd5e4', san: 'dxe4', line: ['d5e4'], net: 3, mate: null }],
  },
  calm: {
    ...questionBase,
    kind: 'calm',
    fen_before: '4k3/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
    played_san: 'Kf1',
    threats: [],
  },
  allows: {
    ...questionBase,
    kind: 'allows',
    fen_before: '6k1/5ppp/5q2/8/7B/P1N5/5PPP/6K1 b - - 0 1',
    fen_prev: '6k1/5ppp/5q2/8/7B/2N5/P4PPP/6K1 w - - 0 1',
    prev_uci: 'a2a3',
    played_san: 'a3',
    threats: [{ uci: 'f6c3', san: 'Qxc3', line: ['f6c3'], net: 3, mate: null }],
  },
  vision: {
    ...questionBase,
    kind: 'vision',
    fen_before: '3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1',
    played_san: 'Qa1',
    threats: [
      { uci: 'd1d8', san: 'Qxd8#', line: ['d1d8'], net: 5, mate: null },
    ],
  },
};

function createPreviewSession(
  empty?: EmptyDeck,
  loadDelay = 0,
  watch = false,
  question?: QuestionKind,
) {
  const samples = watch ? [raidSample, ...previewSamples] : previewSamples;
  let index = 0;
  // Storybook's slow network: only the first deck waits.
  let delay = loadDelay;
  let puzzles = 0;
  const results: Deck['results'] = [];
  const puzzleResults: NonNullable<Deck['puzzle_results']> = [];
  let asking = question ? questionSamples[question] : undefined;
  const deck = (): Deck => {
    const sample = samples[index];
    const { best: _best, ...card } = sample ?? { best: '' };
    const { line: _line, ...served } = puzzle;
    if (empty)
      // A deck with nothing in it yet, and the games behind it.
      return {
        server_day: '2026-10-12',
        total: 0,
        mastered: 0,
        learning: 0,
        new: 0,
        today: { done: 0, total: 0 },
        card: null,
        puzzle: null,
        puzzles: { done: 0, session: 5, available: true },
        games: empty.games,
        results: [],
      };
    return {
      server_day: '2026-10-12',
      total: samples.length,
      mastered: 0,
      learning: results.length,
      new: samples.length - results.length,
      today: { done: results.length, total: samples.length },
      // The watch's count: the positions and the one puzzle after them.
      lesson: {
        done: results.length + puzzleResults.length,
        total: samples.length + 1,
      },
      card:
        sample && !asking
          ? ({ ...card, line_key: '0000000000000000' } as PracticeCard)
          : null,
      threat_item: asking ?? null,
      puzzle: !sample && puzzles < 1 ? served : null,
      puzzles: { done: puzzleResults.length, session: 1, available: true },
      results: [...results],
      puzzle_results: [...puzzleResults],
    };
  };
  const wait = () => new Promise((resolve) => setTimeout(resolve, 250));
  const hint = (line: readonly string[], moves: readonly string[]) => {
    const best = line[moves.length] ?? '';
    return { best_uci: best, from: moveFromUci(best).from };
  };
  return new PracticeSession(
    {
      deck: async () => {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        delay = 0;
        return deck();
      },
      extraWatch: async () => deck(),
      lineHint: async (body) =>
        hint(
          ((sample) => sample?.line ?? [sample?.best ?? ''])(
            samples.find((s) => s.game_id === body.game_id),
          ),
          body.moves ?? [],
        ),
      puzzleHint: async (body) => hint(puzzle.line, body.moves ?? []),
      // The preview's samples are cards and a puzzle: no "Your move" items.
      unannouncedAnswer: async () => {
        throw new Error('The preview serves no Your move positions.');
      },
      threatAnswer: async (body) => {
        await wait();
        const sample = samples.find((s) => s.game_id === body.game_id);
        const threats =
          asking?.game_id === body.game_id
            ? asking.threats
            : (sample?.threat?.threats ?? []);
        if (asking?.game_id === body.game_id) asking = undefined;
        return {
          correct: threats.some((t) => t.uci === body.answer),
          threats,
          rating: null,
          due: null,
        };
      },
      answerLine: async (body) => {
        await wait();
        const sample = samples.find((s) => s.game_id === body.game_id);
        if (!sample) throw new Error('No sample');
        const result = grade(
          sample.fen_before,
          sample.line ?? [sample.best],
          body.moves ?? [],
        );
        if (result.status === 'continue') return result;
        if (!results.some((r) => r.game_id === sample.game_id))
          results.push({
            game_id: sample.game_id,
            ply: sample.ply,
            correct: result.correct,
            mark:
              result.status === 'shown' || body.hinted
                ? 'helped'
                : result.correct
                  ? 'found'
                  : 'missed',
            san: sample.san,
            opponent: sample.opponent,
          });
        if (result.status !== 'failed') index += 1;
        return result;
      },
      puzzleAnswer: async (body) => {
        await wait();
        const result = grade(puzzle.fen_before, puzzle.line, body.moves);
        if (result.status === 'continue') return result;
        if (!puzzleResults.length)
          puzzleResults.push({
            id: puzzle.id,
            correct: result.correct && !body.hinted,
            rating: puzzle.rating,
            themes: puzzle.themes,
          });
        if (result.status !== 'failed') puzzles += 1;
        return result;
      },
    },
    () => true,
    undefined,
    undefined,
    undefined,
    undefined,
    'lesson',
  );
}

/** Practice with sample positions. */
/** Storybook's empty deck: the games analysed and still waiting. */
type EmptyDeck = { games: { analyzed: number; pending: number } };

export function PracticePreview({
  empty,
  loadDelay,
  watch,
  question,
}: {
  /** A threat question of this kind first. */
  question?: QuestionKind;
  /** Seen from the castle wall, as the daily lesson is. */
  watch?: boolean;
  empty?: EmptyDeck;
  /** Holds the first deck this long (ms), to show the loading frame. */
  loadDelay?: number;
}) {
  const [session] = useState(() => {
    const created = createPreviewSession(empty, loadDelay, watch, question);
    void created.load();
    return created;
  });
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return (
    <PracticeLayout
      session={session}
      state={state}
      onExit={() => {}}
      lesson
      watch={watch}
    />
  );
}
