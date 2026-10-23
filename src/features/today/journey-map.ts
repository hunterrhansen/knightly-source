import type {
  JourneyMap,
  JourneyRank,
  JourneyStar,
} from '../../lib/api/journey-contract';
import { addDays } from '../../ui';

// The nights of the home path (docs/specs/2026-10-19-path-home-design.md,
// moved from the watch story's map of nights): every night kept as a node on
// a winding path, tonight ringed, the next nights grey above, and rank
// castles beside the path. A castle is reached by stars, never by nights, so
// the next one is placed by the learner's pace and its label promises no date.

/** Grey nights drawn above tonight: a week of the schedule ahead. */
export const LOOKAHEAD = 7;
/** Past nights drawn below tonight; older ones are summarised at the start. */
const HISTORY = 120;

/** What a kept night's or extra watch's answers did (`/api/journey`'s
 * `history`). */
export type HeldCounts = NonNullable<JourneyMap['history']>['nights'][number];

type MapNight = {
  night: number;
  state: 'kept' | 'tonight' | 'ahead';
  /** The night's date, when the server says it: every kept night from
   * `history`, tonight, and the nights ahead. */
  date?: string;
  /** What a kept night's watch held, from `history`. */
  held?: HeldCounts;
  /** The extra watches finished that night, oldest first. */
  extras: HeldCounts[];
  /** Tonight's watch is already kept. */
  keptTonight?: boolean;
  /** A night milestone (7, 30, 100, 365) on this node. */
  milestone?: number;
  /** Stars earned on this night, oldest first; a dimmed one stays counted. */
  stars: JourneyStar[];
  /** Rank castles beside this node. */
  castles: MapCastle[];
};

export type MapCastle = {
  key: string;
  name: string;
  state: 'reached' | 'next' | 'later';
  reachedOn: string | null;
  /** The posts still to clear before it (next and later ranks); null when the
   * server sends no curriculum to count them from. */
  toGo: number | null;
  /** The post the castle stands after, whose clearing reaches its rank
   * (docs/specs/2026-10-20-ward-path-design.md). Absent for Page, reached with
   * the first watch, and for the keep. */
  after?: number;
  /** A post castle beyond the curriculum (the keep). */
  beyond?: boolean;
};

export type JourneyModel = {
  stars: number;
  dimmed: number;
  rank: { key?: string; name: string };
  /** "Squire II · ★ 23" */
  chip: string;
  tonight: number;
  /** Top of the map first: the furthest grey night down to the oldest shown. */
  nights: MapNight[];
  /** Ranks beyond the next, faint above the path's end. */
  later: MapCastle[];
  /** Kept nights older than the first one drawn. */
  earlier: number;
  next: MapCastle | null;
};

/** The last rank reached, by index (-1: none yet). */
const lastReached = (journey: JourneyMap) =>
  journey.ranks.reduce((last, rank, i) => (rank.reached_on ? i : last), -1);

/** The learner's rank and its chip ("Squire II · ★ 23"), as the home's top
 * bar and Progress show it. */
export function journeyRank(journey: JourneyMap) {
  const current = journey.ranks[Math.max(0, lastReached(journey))];
  const rank = current
    ? { key: current.key, name: journey.rank || current.name }
    : { name: journey.rank };
  return {
    rank,
    stars: journey.stars,
    dimmed: journey.dimmed,
    chip: `${rank.name} · ★ ${journey.stars}`,
  };
}

/** The posts up to and including `post` not yet cleared (a blocked post never
 * counts), or null when the server sends no curriculum. */
function openPosts(journey: JourneyMap, post: number) {
  if (!journey.wards?.length) return null;
  return journey.wards.filter(
    (w) => w.index <= post && w.state !== 'cleared' && w.state !== 'blocked',
  ).length;
}

/** The path's section: a section is a rank, the stretch between two castles,
 * so its number is the current rank's place (1 for Page, which counts from
 * before the first watch), and it ends when the next castle's posts are
 * cleared. `next` is null when no post reaches another rank (the keep). */
export function journeySection(journey: JourneyMap) {
  const current = Math.max(0, lastReached(journey));
  const next = journey.ranks.find((rank, i) => i > current && !rank.reached_on);
  const post = next?.post ?? null;
  return {
    number: current + 1,
    rank: journeyRank(journey).rank.name,
    next: next && post !== null ? { name: next.name, post } : null,
    toGo: post !== null ? openPosts(journey, post) : null,
  };
}

const dayNumber = (date: string) =>
  Math.round(Date.parse(`${date}T12:00:00Z`) / 86_400_000);

/**
 * The night a past date fell on, from the nights whose dates are known: the
 * first night (Page's day), each reached milestone and tonight. Between two
 * known nights the nights kept are spread evenly over the days, which is
 * exact for an unbroken run and close otherwise. Clamped to the nights kept.
 */
export function nightOn(
  date: string,
  known: readonly { night: number; date: string }[],
  kept: number,
) {
  const points = [...known].sort((a, b) => a.night - b.night);
  const first = points[0];
  if (!first || kept < 1) return 1;
  const day = dayNumber(date);
  let night = first.night;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a) break;
    const at = dayNumber(a.date);
    if (day <= at) {
      night = a.night;
      break;
    }
    if (!b) {
      night = a.night;
      break;
    }
    const bt = dayNumber(b.date);
    if (day <= bt) {
      night =
        bt === at
          ? b.night
          : a.night +
            Math.round(((b.night - a.night) * (day - at)) / (bt - at));
      break;
    }
  }
  return Math.max(1, Math.min(kept, night));
}

/**
 * The night a past date fell on, exactly, from every kept night's date
 * (oldest first: the Nth is night N): the last night kept on or before it, or
 * the first. A date from today on is tonight's, kept or not.
 */
function exactNightOn(
  date: string,
  dates: readonly string[],
  today: string,
  tonight: number,
) {
  if (date >= today) return tonight;
  const before = dates.filter((d) => d <= date).length;
  return Math.max(1, before);
}

/** The map from `/api/journey`, `today` (the learner's local day) and
 * whether tonight's watch is already kept. */
export function journeyModel(
  journey: JourneyMap,
  today: string,
  keptTonight: boolean,
): JourneyModel {
  const kept = journey.nights.total;
  // Tonight is the night after the last one kept, unless it is kept already.
  const tonight = keptTonight ? Math.max(1, kept) : kept + 1;
  const page = journey.ranks.find((rank) => rank.key === 'page')?.reached_on;
  const known = [
    ...(page ? [{ night: 1, date: page }] : []),
    ...journey.nights.milestones.flatMap((m) =>
      m.reached_on ? [{ night: m.nights, date: m.reached_on }] : [],
    ),
    { night: tonight, date: today },
  ];
  // With every kept night's date (servers since the path's schedule), stars,
  // castles and extra watches stand on their real nights; before that, they
  // are spread between the known dates.
  const history = journey.history;
  const dates = history?.nights.map((n) => n.date);
  const pastNight = (date: string) =>
    dates
      ? exactNightOn(date, dates, today, tonight)
      : nightOn(date, known, kept);
  const stars = journey.stars;
  const castle = (rank: JourneyRank, i: number): MapCastle => ({
    key: rank.key,
    name: rank.name,
    state: rank.reached_on
      ? 'reached'
      : i === journey.ranks.findIndex((r) => !r.reached_on)
        ? 'next'
        : 'later',
    reachedOn: rank.reached_on,
    toGo: rank.post !== null ? openPosts(journey, rank.post) : null,
    ...(rank.post !== null ? { after: rank.post } : {}),
    ...(rank.post === null && rank.key !== 'page' ? { beyond: true } : {}),
  });
  const castles = journey.ranks.map(castle);
  const next = castles.find((c) => c.state === 'next') ?? null;
  const top = tonight + LOOKAHEAD;
  const bottom = Math.max(1, tonight - HISTORY);
  const nights: MapNight[] = [];
  for (let night = top; night >= bottom; night--) {
    const record = history?.nights[night - 1];
    const date =
      night >= tonight ? addDays(today, night - tonight) : record?.date;
    nights.push({
      night,
      state: night < tonight ? 'kept' : night === tonight ? 'tonight' : 'ahead',
      ...(night === tonight && keptTonight ? { keptTonight: true } : {}),
      ...(date ? { date } : {}),
      ...(record && night <= tonight ? { held: record } : {}),
      extras: [],
      milestone: journey.nights.milestones.find((m) => m.nights === night)
        ?.nights,
      stars: [],
      castles: [],
    });
  }
  const at = (night: number) =>
    nights.find((n) => n.night === Math.max(bottom, Math.min(top, night)));
  // An extra watch is on the night of its date; once tonight is kept,
  // tonight's are on tonight. Nights before the first drawn have none drawn.
  for (const watch of history?.extra ?? []) {
    const night = pastNight(watch.date);
    if (night >= bottom && night <= tonight) at(night)?.extras.push(watch);
  }
  for (const star of journey.star_list)
    at(pastNight(star.earned_on))?.stars.push(star);
  for (const c of castles) {
    const page = c.key === 'page';
    if (c.state === 'reached' && c.reachedOn)
      at(page ? 1 : pastNight(c.reachedOn))?.castles.push(c);
    // Page is reached with the first watch: its castle waits at tonight. The
    // next post castle comes when its posts clear, which no pace predicts: it
    // stands at the end of the path drawn.
    if (c.state === 'next') at(page ? tonight : top)?.castles.push(c);
  }
  const { rank, chip } = journeyRank(journey);
  return {
    stars,
    dimmed: journey.dimmed,
    rank,
    chip,
    tonight,
    nights,
    later: castles.filter((c) => c.state === 'later'),
    earlier: Math.max(0, bottom - 1),
    next,
  };
}
