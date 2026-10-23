import type { GameSummary, GamesPage } from '../../lib/api/import-contract';
import type { GameFilters } from '../../lib/api/progress-contract';

/** The list's scope: every game, games where moves slipped past you, or
 * analysed games with none (watch story spec, "Games"). */
export type GamesScope = 'all' | 'slipped' | 'clean';
export type GamesFilterDraft = Pick<
  GameFilters,
  'speed' | 'result' | 'color' | 'range' | 'kpi' | 'review_status'
>;
export const filterChoices = {
  result: {
    title: 'Result',
    options: [
      { value: '', label: 'Any result' },
      { value: 'win', label: 'Wins' },
      { value: 'loss', label: 'Losses' },
      { value: 'draw', label: 'Draws' },
    ],
  },
  speed: {
    title: 'Speed',
    options: [
      { value: '', label: 'Any speed' },
      { value: 'bullet', label: 'Bullet' },
      { value: 'blitz', label: 'Blitz' },
      { value: 'rapid', label: 'Rapid' },
      { value: 'daily', label: 'Daily' },
      { value: 'classical', label: 'Classical' },
    ],
  },
  color: {
    title: 'Your color',
    options: [
      { value: '', label: 'Either color' },
      { value: 'white', label: 'As White' },
      { value: 'black', label: 'As Black' },
    ],
  },
  range: {
    title: 'Period',
    options: [
      { value: '', label: 'All time' },
      { value: '30d', label: 'Last 30 days' },
      { value: '90d', label: 'Last 90 days' },
    ],
  },
  kpi: {
    title: 'Learning focus',
    options: [
      { value: '', label: 'Any focus' },
      { value: 'blunders', label: 'Had a blunder' },
      { value: 'thrown', label: 'Thrown wins' },
      { value: 'unpunished', label: 'Missed opportunities' },
      { value: 'comebacks', label: 'Comebacks' },
    ],
  },
  review_status: {
    title: 'Review status',
    options: [
      { value: '', label: 'Any status' },
      { value: 'to_review', label: 'To review' },
      { value: 'reviewed', label: 'Reviewed' },
    ],
  },
} as const;
export const filterKeys = [
  'result',
  'speed',
  'color',
  'range',
  'kpi',
  'review_status',
] as const;
export function filterLabel(key: (typeof filterKeys)[number], value: string) {
  return (
    filterChoices[key].options.find((option) => option.value === value)
      ?.label ?? value
  );
}
export function resultLabel(game: GameSummary) {
  return game.outcome === 'win'
    ? 'Win'
    : game.outcome === 'loss'
      ? 'Loss'
      : game.outcome === 'draw'
        ? 'Draw'
        : 'Result unavailable';
}
export function reviewLabel(game: GameSummary) {
  if (game.reviewed_at) return 'Reviewed';
  if (!game.analysed) return 'Awaiting analysis · Replay available';
  if (!game.color) return 'Replay available';
  return 'To review';
}
/** Where a game's slips are, by colour: on watch (sky), held (green),
 * stopped slipping (gold), Clean, or still being analysed. */
export type SlipTone = 'watch' | 'held' | 'stopped' | 'clean' | 'pending';

/** A row's status by its slips: the earliest state any of them is in ("3 on
 * watch" before "2 held" before "1 stopped slipping"), Clean when nothing
 * slipped, or "Checking for slips…" until analysed. Undefined from servers
 * that send no slips, which keep the review status. */
export function slipStatus(
  game: Pick<GameSummary, 'analysed' | 'slips'>,
): { label: string; tone: SlipTone } | undefined {
  const { slips } = game;
  if (slips === undefined) return undefined;
  if (slips === null)
    return game.analysed
      ? undefined
      : { label: 'Checking for slips…', tone: 'pending' };
  if (slips.on_watch > 0)
    return { label: `${slips.on_watch} on watch`, tone: 'watch' };
  if (slips.held > 0) return { label: `${slips.held} held`, tone: 'held' };
  if (slips.stopped > 0)
    return { label: `${slips.stopped} stopped slipping`, tone: 'stopped' };
  return { label: 'Clean', tone: 'clean' };
}

/** The summary card's words for the last seven days, or undefined while no
 * game in them is analysed (and from servers without the week). */
export function weekSummary(week: GamesPage['week']) {
  if (!week || week.analysed === 0) return undefined;
  return {
    eyebrow: `Last 7 days · ${week.games} ${week.games === 1 ? 'game' : 'games'}`,
    title:
      week.slipped === 0
        ? 'Nothing slipped past you'
        : `${week.slipped} ${week.slipped === 1 ? 'move' : 'moves'} slipped past you`,
    chips: [
      { tone: 'watch', label: `${week.on_watch} on your watch` },
      { tone: 'held', label: `${week.held} held` },
      { tone: 'stopped', label: `${week.stopped} stopped slipping` },
    ] as const,
  };
}
function timeControl(value?: string | null) {
  if (!value) return null;
  const match = /^(\d+)(?:\+(\d+))?$/.exec(value);
  if (!match) return value;
  const seconds = Number(match[1]);
  if (seconds >= 86400)
    return `${seconds / 86400} day${seconds === 86400 ? '' : 's'}`;
  const base = seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sec`;
  return match[2] && Number(match[2]) > 0 ? `${base} + ${match[2]} sec` : base;
}
export function gameMetadata(game: GameSummary) {
  return [
    game.speed ? game.speed[0]?.toUpperCase() + game.speed.slice(1) : null,
    timeControl(game.time_control),
    game.color ? `As ${game.color === 'white' ? 'White' : 'Black'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
function localDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
/** Whole calendar days from `date` to `now` in local time (DST-safe). */
function daysAgo(date: Date, now: Date) {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(date)) / 86_400_000);
}
/** Section titles like iOS lists: Today, Yesterday, then the weekday for the
 * rest of the past week, then the date. */
export function groupGames(games: GameSummary[], now = new Date()) {
  const groups = new Map<string, { title: string; games: GameSummary[] }>();
  for (const game of games) {
    const date = game.played_at ? new Date(game.played_at) : null;
    const valid = date && Number.isFinite(date.getTime()) ? date : null;
    const key = valid ? localDay(valid) : 'unknown';
    const ago = valid ? daysAgo(valid, now) : null;
    const title = !valid
      ? 'Date unavailable'
      : ago === 0
        ? 'Today'
        : ago === 1
          ? 'Yesterday'
          : ago !== null && ago > 1 && ago < 7
            ? valid.toLocaleDateString(undefined, { weekday: 'long' })
            : valid.toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                ...(valid.getFullYear() !== now.getFullYear()
                  ? { year: 'numeric' }
                  : {}),
              });
    const group = groups.get(key) ?? { title, games: [] };
    group.games.push(game);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}
