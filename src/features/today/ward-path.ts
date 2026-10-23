import type {
  JourneyLesson,
  JourneyMap,
  JourneyWard,
} from '../../lib/api/journey-contract';
import type { MapCastle } from './journey-map';
import { POST_RANKS, postCopy, rankOfPost } from './ward-copy';

// The path through the wards (docs/specs/2026-10-20-ward-path-design.md, "Home:
// the ward path"): the curriculum's posts as sections and their lessons as
// nodes, from `/api/journey`'s `wards`. Pure. The server derives each post's
// state on every read; this decides only how it is drawn: which lesson the
// beacon stands on, the rank castles between posts, and which posts show.

/** The Steps Method's bar (backend wards.BASIC_VOLUME, PAGE, PAGE_RIGHT): a
 * lesson's basic volume of positions, a workbook page, and how many of a page
 * must be right. */
const BASIC_VOLUME = 36;
const PAGE = 12;
const PAGE_RIGHT = 10;

/** A lesson as the path draws it. */
export type PathLesson = {
  ward: string;
  key: string;
  name: string;
  track: string;
  held: boolean;
  /** Positions answered since its post was reached. */
  answered: number;
  /** Right first try among the last PAGE answered. */
  pageRight: number;
  teachable: boolean;
};

/** A post as the path and its cards show it. */
export type PathPost = {
  key: string;
  index: number;
  state: JourneyWard['state'];
  place: string;
  topic: string;
  baileyName: string;
  line: string | null;
  lore: string | null;
  rank: string;
  /** The day it was first cleared, once the server records it. */
  clearedOn: string | null;
  /** The day the learner reached it, once the server records it: the watches
   * kept since then are this post's nodes. */
  enteredOn: string | null;
  lessons: readonly PathLesson[];
};

const pathLesson = (ward: string, lesson: JourneyLesson): PathLesson => ({
  ward,
  key: lesson.key,
  name: lesson.name,
  track: lesson.track,
  held: lesson.held,
  // A server before the Steps bar sends only solves.
  answered: lesson.answered ?? lesson.solves,
  pageRight: lesson.page_right ?? Math.min(PAGE, lesson.solves),
  teachable: lesson.teachable,
});

function pathPost(ward: JourneyWard): PathPost {
  const copy = postCopy(ward);
  return {
    key: ward.key,
    index: ward.index,
    state: ward.state,
    place: copy.place,
    topic: copy.topic,
    baileyName: copy.baileyName,
    line: copy.line,
    lore: copy.lore,
    rank: rankOfPost(ward.index).name,
    clearedOn: ward.cleared_on ?? null,
    enteredOn: ward.entered_on ?? null,
    lessons: ward.lessons.map((l) => pathLesson(ward.key, l)),
  };
}

/** The lesson tonight's beacon stands on: the current post's first teachable
 * lesson not yet held, else its last (every lesson held at the last post). */
function beaconLesson(post: PathPost): PathLesson | null {
  return (
    post.lessons.find((l) => l.teachable && !l.held) ??
    post.lessons.at(-1) ??
    null
  );
}

/** "1 of 2 lessons held", counting only the lessons that can be taught. */
export function heldLine(post: PathPost) {
  const teachable = post.lessons.filter((l) => l.teachable);
  const held = teachable.filter((l) => l.held).length;
  return `${held} of ${teachable.length} ${teachable.length === 1 ? 'lesson' : 'lessons'} held`;
}

/** A lesson's words in its post's card. */
export function lessonDetail(lesson: PathLesson) {
  if (!lesson.teachable) return 'Coming soon';
  if (lesson.held) return 'Held';
  if (lesson.answered < BASIC_VOLUME)
    return `${lesson.answered} of ${BASIC_VOLUME} answered`;
  return `${lesson.pageRight} of ${PAGE} right lately, ${PAGE_RIGHT} needed`;
}

/**
 * The rank castles between posts: one after every third post, and Castellan
 * after the last (POST_RANKS). A castle is reached when every post before it is
 * cleared or blocked (a blocked post never counts for or against a rank), or
 * when the server's ranks already have it reached; a rank once reached is not
 * lost. A castle past the posts the server sent stands `beyond` them: an older
 * server's shorter walk.
 */
function postCastles(
  posts: readonly PathPost[],
  ranks: JourneyMap['ranks'],
): MapCastle[] {
  const castles: MapCastle[] = [];
  let nextFound = false;
  for (const rank of POST_RANKS.slice(1)) {
    const at = rank.post ?? posts.length;
    const beyond = at > posts.length;
    const before = posts.filter((p) => p.index <= at);
    const open = before.filter(
      (p) => p.state !== 'cleared' && p.state !== 'blocked',
    ).length;
    const server = ranks.find((r) => r.key === rank.key);
    const reached = !!server?.reached_on || (!beyond && open === 0);
    const state: MapCastle['state'] = reached
      ? 'reached'
      : nextFound
        ? 'later'
        : 'next';
    if (state === 'next') nextFound = true;
    castles.push({
      key: rank.key,
      name: rank.name,
      state,
      reachedOn: server?.reached_on ?? null,
      toGo: beyond ? 0 : open,
      after: Math.min(at, posts.length),
      beyond,
    });
  }
  return castles;
}

/** The rank the learner holds on the path: the higher of the server's (a rank
 * once reached is never lost) and the last post castle reached. */
function postRank(journey: JourneyMap, posts: readonly PathPost[]) {
  const reachedIndex = (key: string) =>
    POST_RANKS.findIndex((r) => r.key === key);
  const server = journey.ranks.reduce(
    (last, rank) =>
      rank.reached_on ? Math.max(last, reachedIndex(rank.key)) : last,
    0,
  );
  const byPosts = postCastles(posts, journey.ranks).reduce(
    (last, castle) =>
      castle.state === 'reached'
        ? Math.max(last, reachedIndex(castle.key))
        : last,
    0,
  );
  return POST_RANKS[Math.max(server, byPosts)] ?? { key: 'page', name: 'Page' };
}

export type WardPathLayout = {
  current: PathPost;
  /** Above the current post, nearest last: every post still to walk. */
  ahead: PathPost[];
  /** Below it, nearest first: cleared and blocked posts. */
  behind: PathPost[];
  beacon: PathLesson | null;
  castles: MapCastle[];
  rank: { key: string; name: string };
};

/** Which posts the path draws around the current one, or null when the
 * server sends no curriculum (an older server) or no current post. */
export function wardPathLayout(journey: JourneyMap): WardPathLayout | null {
  const wards = journey.wards;
  if (!wards?.length) return null;
  const posts = [...wards].sort((a, b) => a.index - b.index).map(pathPost);
  const current = posts.find((p) => p.state === 'current');
  if (!current) return null;
  return {
    current,
    ahead: posts.filter((p) => p.index > current.index).reverse(),
    behind: posts.filter((p) => p.index < current.index).reverse(),
    beacon: beaconLesson(current),
    castles: postCastles(posts, journey.ranks),
    rank: postRank(journey, posts),
  };
}

/** Progress's rank line on the ward path: "Squire I · Post 4" and what the
 * next castle waits on, or null without the curriculum. */
export function postRankLine(journey: JourneyMap) {
  const layout = wardPathLayout(journey);
  if (!layout) return null;
  const next = layout.castles.find((c) => c.state === 'next' && !c.beyond);
  return {
    rank: layout.rank,
    chip: `${layout.rank.name} · Post ${layout.current.index}`,
    next: next
      ? `${next.toGo} ${next.toGo === 1 ? 'post' : 'posts'} to ${next.name}`
      : 'Every post held so far',
  };
}

/** What a session moved on the ward path, for the session end's post beat
 * (docs/specs/2026-10-20-ward-path-design.md, "Moments"). */
export type PostMoment = {
  /** Posts cleared by this session, in order. */
  cleared: PathPost[];
  /** The post the learner moved on to, when the current one changed. */
  next: PathPost | null;
  /** "Middle Ward" when moving on crossed into another ward. */
  enteredWard: string | null;
  /** A rank reached by clearing posts this session. */
  rank: { key: string; name: string } | null;
};

/**
 * The post beat, from `/api/journey` read before the session and after it,
 * as the rank-up beat compares `/api/home`. A post counts only if this
 * session cleared it: cleared after and not before, and not first cleared on
 * an earlier day (the server's record), so a post that slipped and cleared
 * again never celebrates twice. Null when nothing moved.
 */
export function postMoment(
  before: JourneyMap | undefined,
  after: JourneyMap | undefined,
  today: string,
): PostMoment | null {
  const was = before && wardPathLayout(before);
  const now = after && wardPathLayout(after);
  if (!was || !now || !before.wards || !after.wards) return null;
  const clearedBefore = new Set(
    before.wards.filter((w) => w.state === 'cleared').map((w) => w.key),
  );
  const cleared = [...after.wards]
    .sort((a, b) => a.index - b.index)
    .filter(
      (w) =>
        w.state === 'cleared' &&
        !clearedBefore.has(w.key) &&
        (!w.cleared_on || w.cleared_on >= today),
    )
    .map(pathPost);
  const next = now.current.key !== was.current.key ? now.current : null;
  const order = (key: string) => POST_RANKS.findIndex((r) => r.key === key);
  const rank = order(now.rank.key) > order(was.rank.key) ? now.rank : null;
  if (!cleared.length && !next && !rank) return null;
  return {
    cleared,
    next,
    enteredWard:
      next && next.baileyName !== was.current.baileyName
        ? next.baileyName
        : null,
    rank,
  };
}

/** What a puzzle served as `taught` is teaching: the current post's place and
 * the lesson it most likely serves (the server draws a post's unheld lessons
 * first). Null without a post or a teachable lesson. */
export function taughtAt(
  ward: JourneyWard | null | undefined,
): { place: string; lesson: string } | null {
  if (!ward) return null;
  const teachable = ward.lessons.filter((l) => l.teachable);
  const lesson = teachable.find((l) => !l.held) ?? teachable[0];
  return lesson ? { place: postCopy(ward).place, lesson: lesson.name } : null;
}
