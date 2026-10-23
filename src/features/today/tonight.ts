import type { DailyReview, TonightCard } from '../../lib/api/today-contract';

// The Watch page's words and rows (docs/specs/2026-10-18-watch-story-design.md,
// "Watch (home)"). Pure: the clock is passed in. The rows are `/api/home`'s
// `today.tonight`: up to three of the lesson's moves, named by the server.

/** The header's title: "Tonight" from 17:00 local time, "Today" before. */
export const watchTitle = (now: Date) =>
  now.getHours() >= 17 ? 'Tonight' : 'Today';

/** The direction's night rule: after 21:00 (and until morning) nothing
 * bursts; celebrations glow instead of throwing confetti. */
export const isLateNight = (now: Date) =>
  now.getHours() >= 21 || now.getHours() < 5;

/** A move's chip: never answered, answered wrong before, or one review from
 * stopping slipping. */
export type TonightChip = 'New' | '2nd look' | 'Almost held' | 'Last check';

export type TonightRow = {
  gameId: number;
  ply: number;
  fen: string;
  /** The learner's side, at the bottom of the board. */
  color: 'white' | 'black';
  label: string;
  /** When its game was played ("yesterday"), if known. */
  day: string | null;
  detail: string;
  chip: TonightChip | null;
};

/** Whole local calendar days from `date` to `now` (DST-safe). */
function daysAgo(date: Date, now: Date) {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(date)) / 86_400_000);
}

/** When a game was played, as the watch says it: "today", "yesterday", the
 * weekday within the week, then "last week" or the date. */
function playedDay(playedAt: string | null | undefined, now: Date) {
  const date = playedAt ? new Date(playedAt) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  const ago = daysAgo(date, now);
  if (ago <= 0) return 'today';
  if (ago === 1) return 'yesterday';
  if (ago < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  if (ago < 14) return 'last week';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const chips: Record<NonNullable<TonightCard['chip']>, TonightChip> = {
  new: 'New',
  again: '2nd look',
  almost: 'Almost held',
};

/** A move row: the position, the move's label and where it came from. Null
 * without a position to draw. */
function tonightRow(card: TonightCard, now: Date): TonightRow | null {
  if (!card.fen) return null;
  const day = playedDay(card.played_at, now);
  return {
    gameId: card.game_id,
    ply: card.ply,
    fen: card.fen,
    color: card.color,
    label: `${card.label} · ${card.san}`,
    day,
    detail: [card.opponent && `vs ${card.opponent}`, day]
      .filter(Boolean)
      .join(' · '),
    chip: card.chip ? chips[card.chip] : null,
  };
}

/** Tonight's rows, from the daily review's `tonight` (none from older servers). */
export function tonightRows(
  review: Pick<DailyReview, 'tonight'>,
  now: Date,
): TonightRow[] {
  return (review.tonight?.cards ?? []).flatMap(
    (card) => tonightRow(card, now) ?? [],
  );
}

const relative = new Set(['today', 'yesterday', 'last week']);
const moves = (n: number) => `${n} ${n === 1 ? 'move' : 'moves'}`;

/** When the new slips happened: their games' day when the rows show them all
 * on one day, else "this week". */
function slipDay(rows: readonly TonightRow[], slipped: number) {
  const fresh = rows.filter((row) => row.chip === 'New');
  const days = new Set(fresh.map((row) => row.day));
  const [day] = [...days];
  if (days.size !== 1 || !day || fresh.length < slipped) return 'this week';
  return relative.has(day) ? day : `on ${day}`;
}

/** The tonight card's headline and coach line. New slips lead with when they
 * happened; otherwise the watch is the moves being kept hold of. */
export function tonightHeadline(
  review: Pick<DailyReview, 'lesson' | 'tonight'>,
  rows: readonly TonightRow[],
) {
  const slipped = review.tonight?.slipped_recent ?? 0;
  if (slipped > 0) {
    const day = slipDay(rows, slipped);
    return slipped === 1
      ? {
          title: `A move slipped past you ${day}`,
          coach: 'It’ll try again tonight. Spot it first.',
        }
      : {
          title: `${moves(slipped)} slipped past you ${day}`,
          coach: 'They’ll try again tonight. Spot them first.',
        };
  }
  const left = Math.max(1, review.lesson.total - review.lesson.done);
  return {
    title: `${moves(left)} you’re keeping hold of`,
    coach: 'Look again before they slip.',
  };
}

/** When a game was played, as its card's title says it ("last night"). */
function gameWhen(playedAt: string | null, now: Date) {
  const day = playedDay(playedAt, now);
  if (day === 'yesterday') return 'last night';
  if (day === 'today' || day === 'last week') return day;
  return day ? `on ${day}` : null;
}

/** The game review folded into the watch: when a newly analysed game's slips
 * lead tonight's lesson (`today.tonight.game`), the card is that game's:
 * "Your game vs kd_88 last night", how many moves slipped past and that they
 * join tonight's watch, and the link to replay the whole game. Null without
 * one (older servers, or no new game). */
export function tonightGame(
  review: Pick<DailyReview, 'tonight'>,
  now: Date,
): { title: string; coach: string; replayHref: string } | null {
  const game = review.tonight?.game;
  if (!game || game.slipped === 0) return null;
  const when = gameWhen(game.played_at, now);
  return {
    title: ['Your game', game.opponent && `vs ${game.opponent}`, when]
      .filter(Boolean)
      .join(' '),
    coach:
      game.slipped === 1
        ? 'A move slipped past you. It joins tonight’s watch.'
        : `${moves(game.slipped)} slipped past you. They join tonight’s watch.`,
    replayHref: `/review/${game.id}`,
  };
}

/** "+ N more" under the rows: the lesson's items not shown as a row. */
export function moreTonight(
  review: Pick<DailyReview, 'lesson' | 'tonight'>,
  rows: number,
) {
  if (review.tonight)
    return review.tonight.remaining + review.tonight.cards.length - rows;
  return Math.max(0, review.lesson.total - review.lesson.done - rows);
}

type TonightResult = Readonly<{
  correct: boolean;
  due?: string | null;
  stopped?: boolean;
  label?: string | null;
}>;

/** A local `YYYY-MM-DD` day as a Date at local midnight, or null. */
function localDay(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y ?? Number.NaN, (m ?? 0) - 1, d);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** When a move that slipped again comes back: "tomorrow", the weekday within
 * the week, else the date. Null when the day is unknown or already here. */
function backOn(due: string | null | undefined, now: Date) {
  const date = due ? localDay(due) : null;
  if (!date) return null;
  const ahead = -daysAgo(date, now);
  if (ahead <= 0) return null;
  if (ahead === 1) return 'tomorrow';
  if (ahead < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Tonight's answers, from the deck's results for today: moves held, moves
 * that slipped past again (and when the first of them is back), and the
 * moves that stopped slipping, by name. */
export function tonightResults(
  results: readonly TonightResult[] | undefined,
  now: Date,
) {
  const all = results ?? [];
  const held = all.filter((result) => result.correct).length;
  const firstDue = all
    .filter((result) => !result.correct && result.due)
    .map((result) => result.due as string)
    .sort()[0];
  return {
    held,
    slipped: all.length - held,
    back: backOn(firstDue, now),
    stoppedLabels: all.flatMap((result) =>
      result.stopped && result.label ? [result.label] : [],
    ),
  };
}

export type TonightOutcome = ReturnType<typeof tonightResults>;

/** The kept results' lines: "N held", "N slipped again · back Thursday" and
 * "{label} stopped slipping" with the star it relit. `stopped` is the day's
 * count (`stopped_today`), which a puzzle can raise without an answer tonight. */
export function keptLines(outcome: TonightOutcome, stopped: number) {
  const labels = outcome.stoppedLabels;
  const count = Math.max(stopped, labels.length);
  const [first] = labels;
  const others = count - 1;
  return {
    held: outcome.held > 0 ? `${moves(outcome.held)} held` : null,
    slipped:
      outcome.slipped > 0
        ? {
            title: `${moves(outcome.slipped)} slipped again`,
            detail: outcome.back
              ? `Back ${outcome.back}`
              : 'Back on a later watch',
          }
        : null,
    stopped:
      count > 0
        ? {
            title: first
              ? others > 0
                ? `${first} and ${others} more stopped slipping`
                : `${first} stopped slipping`
              : `${moves(count)} stopped slipping`,
            detail: count === 1 ? 'A star relit' : `${count} stars relit`,
          }
        : null,
  };
}
