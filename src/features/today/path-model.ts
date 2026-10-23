import type {
  AheadDay,
  JourneyMap,
  JourneyStar,
} from '../../lib/api/journey-contract';
import type { DailyReview } from '../../lib/api/today-contract';
import {
  type HeldCounts,
  journeyModel,
  journeySection,
  type MapCastle,
} from './journey-map';
import {
  type GamesChecked,
  sectionSubtitle,
  type TodayState,
} from './today-state';
import {
  heldLine,
  type PathLesson,
  type PathPost,
  wardPathLayout,
} from './ward-path';

// The home path (docs/specs/2026-10-19-path-home-design.md, "Home: the path"):
// the learner's review schedule laid out as a road, newest at the top. Each
// night's node is what the schedule has due (tonight's lesson, unchanged);
// sections are ranks, ended only by stars; the focus only describes. Pure:
// every label comes from the daily review and `/api/journey`.

export type PathNodeKind =
  | 'kept'
  | 'tonight'
  | 'extra'
  | 'extraKept'
  | 'tomorrow'
  | 'ahead'
  | 'connect'
  | 'finding'
  | 'firstWatch'
  /** The ward path: a post ahead, cleared behind, or blocked. */
  | 'post'
  /** The ward path: where the road passes from one ward into the next. */
  | 'gate'
  /** The ward path: a lesson of a post ahead, not reached yet. */
  | 'locked'
  /** The ward path: a rank castle on the road, between two posts. */
  | 'castle';

export type PathNode = {
  key: string;
  kind: PathNodeKind;
  /** Done is green, current is the one lit node, later is grey. */
  state: 'done' | 'current' | 'later';
  /** The night it is, all time (null for the first night's steps). */
  night: number | null;
  /** Words beside the node; empty for an unlabelled one. */
  title: string;
  detail: string | null;
  /** A night milestone (7, 30, 66, 100) on this node. */
  milestone?: number;
  stars: readonly JourneyStar[];
  castles: readonly MapCastle[];
  /** Tonight's lesson under way: the node's ring. */
  progress?: { done: number; total: number };
  /** The night's date, when known (kept nights from the journey's history,
   * tonight and the nights ahead). */
  date?: string;
  /** What a kept night or extra watch held, when the server says. */
  held?: HeldCounts;
  /** A night ahead's schedule: the moves due then. */
  ahead?: AheadDay;
  /** On the ward path: the lesson this node is (tonight's beacon and the extra
   * watch carry the lesson they stand on). */
  lesson?: PathLesson;
  /** On the ward path: the post this node is, or whose lesson it is. */
  post?: PathPost;
};

type PathSection = {
  /** "Section 3 · Squire II", or the rank alone before the map has loaded. */
  title: string;
  /** "10 more moves to stop slipping": the stars to the next rank. */
  goal: string;
  /** What the lesson leans toward lately; describes, never decides. */
  subtitle: string;
  /** On the ward path, drawn under the place: the plain topic and the
   * lessons held ("The pin · 1 of 2 lessons held"). */
  topic?: string;
};

export type PathModel = {
  /** Top of the path first. */
  nodes: PathNode[];
  current: PathNode | null;
  section: PathSection | null;
  /** Ranks beyond the next castle. */
  later: readonly MapCastle[];
  /** Kept nights older than the first one drawn. */
  earlier: number;
};

/** The first night's analysing node: games checked of the import's target. */
const checkedLine = (checked: GamesChecked | null) =>
  checked
    ? `${Math.min(checked.done, checked.total)} of ${checked.total} games checked`
    : 'Checking your games…';

/** Tomorrow's node: the moves the schedule has due then. */
const tomorrowLine = (due: number) =>
  due > 0 ? `Tomorrow · ${due} due` : 'Tomorrow · nothing due yet';

/** "Sep 30" for a `YYYY-MM-DD` day. */
const shortDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** "Thu" for a `YYYY-MM-DD` day. */
export const weekday = (date: string) =>
  WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? '';

/** The move a night ahead is named for: its first last check, else the
 * first move due. */
const leadMove = (day: AheadDay) =>
  day.moves.find((m) => m.last_check) ?? day.moves[0];

/** A night ahead's words, from the schedule: "Sat · Qd4’s last check" (a
 * move whose next Good answer would stop it slipping), "Thu · Nf5 comes
 * back", "Fri · 4 due" with the first of them below, or nothing due. */
function aheadWords(day: AheadDay): {
  title: string;
  detail: string | null;
} {
  const name = weekday(day.date);
  const lead = leadMove(day);
  if (!lead || day.due === 0)
    return { title: `${name} · nothing due`, detail: null };
  const others = day.due - 1;
  if (lead.last_check)
    return {
      title: `${name} · ${lead.san}’s last check`,
      detail: others > 0 ? `${day.due} due` : null,
    };
  if (day.due === 1)
    return { title: `${name} · ${lead.san} comes back`, detail: null };
  return {
    title: `${name} · ${day.due} due`,
    detail: `${lead.san} and ${others} more come back`,
  };
}

/** Tomorrow's detail: its last check, when one is due. */
const tomorrowDetail = (day: AheadDay | undefined) => {
  const lead = day && leadMove(day);
  return lead?.last_check ? `${lead.san}’s last check` : null;
};

/** On the ward path the nights are no longer nodes, so tonight's and the
 * extra watch's cards say what comes back when: tomorrow first, then the next
 * nights the schedule serves that have something due, up to `count` in all
 * (docs/specs/2026-10-20-ward-path-design.md, "Home: the ward path"). */
export function comingUp(
  tomorrowDue: number,
  ahead: readonly AheadDay[] | undefined,
  count = 4,
): { key: string; title: string; detail: string | null }[] {
  const [tomorrow, ...later] = ahead ?? [];
  const rows = [
    {
      key: 'tomorrow',
      title: tomorrowLine(tomorrowDue),
      detail: tomorrowDetail(tomorrow),
    },
  ];
  for (const day of later) {
    if (rows.length >= count) break;
    if (day.due === 0) continue;
    rows.push({ key: day.date, ...aheadWords(day) });
  }
  return rows;
}

/** What the section waits on: the posts still to clear for the next castle,
 * or the post itself when they can't be counted. */
const goalLine = (
  next: { name: string; post: number } | null,
  toGo: number | null,
) =>
  next === null
    ? 'The highest rank'
    : toGo === null
      ? `Clear post ${next.post} for ${next.name}`
      : `${toGo} ${toGo === 1 ? 'post' : 'posts'} to ${next.name}`;

/** A post's node key: its marker's, and its card's address. */
export const postKey = (key: string) => `post-${key}`;

const node = (
  over: Partial<PathNode> & Pick<PathNode, 'key' | 'kind' | 'state'>,
): PathNode => ({
  night: null,
  title: '',
  detail: null,
  stars: [],
  castles: [],
  ...over,
});

/** The first night: connect games, find what slipped, then the first watch. */
function firstNight(
  state: Extract<TodayState, { kind: 'new' | 'processing' | 'first' }>,
): PathNode[] {
  const connected = state.kind !== 'new';
  const ready = state.kind === 'first' ? state : undefined;
  return [
    node({
      key: 'first-watch',
      kind: 'firstWatch',
      state: ready ? 'current' : 'later',
      title: 'Your first watch',
      detail: ready ? `About ${ready.minutes} min` : 'About 4 minutes',
    }),
    node({
      key: 'finding',
      kind: 'finding',
      state: ready ? 'done' : connected ? 'current' : 'later',
      title: 'Finding moves that slipped',
      detail: ready
        ? ready.checked
          ? checkedLine(ready.checked)
          : 'Moves found for tonight'
        : state.kind === 'processing'
          ? checkedLine(state.checked)
          : 'Takes a few minutes',
    }),
    node({
      key: 'connect',
      kind: 'connect',
      state: connected ? 'done' : 'current',
      title: 'Connect your games',
      detail: connected ? 'Your Chess.com games' : 'From Chess.com',
    }),
  ];
}

/** Tonight's node words before it is kept. */
function tonightDetail(state: TodayState) {
  if (state.kind === 'rest') return 'Nothing due tonight';
  if (
    state.kind !== 'ready' &&
    state.kind !== 'returning' &&
    state.kind !== 'at-risk'
  )
    return null;
  if (state.start.kind !== 'lesson') return 'Review your game';
  if (state.kind === 'at-risk')
    return state.hoursLeft < 1
      ? 'Less than an hour left'
      : `${Math.round(state.hoursLeft)} hours left`;
  if (state.kind === 'returning')
    return `${state.start.done} of ${state.start.total} · about ${state.minutes} min`;
  return `About ${state.minutes} min`;
}

/** Without `/api/journey` (loading, failed or an older server), the path
 * still has tonight and tomorrow, and the nights kept without castles. */
function journeyOrFallback(review: DailyReview, journey?: JourneyMap) {
  if (journey) return { journey, real: true };
  const summary = review.journey;
  return {
    real: false,
    journey: {
      stars: summary?.stars ?? 0,
      rank: summary?.rank ?? 'Page',
      rank_reached_on: summary?.rank_reached_on ?? null,
      next_rank: summary?.next_rank ?? null,
      next_post: summary?.next_post ?? null,
      dimmed: 0,
      ranks: [],
      star_list: [],
      nights: {
        total: review.streak.nights_total ?? review.streak.count,
        milestones: [],
      },
    } satisfies JourneyMap,
  };
}

/** The section banner: the rank between two castles and the posts to the
 * next. Before the map has loaded, the rank alone from `/api/home`. */
function section(
  focus: DailyReview['focus'],
  summary: DailyReview['journey'] | undefined,
  journey: JourneyMap | undefined,
): PathSection {
  const subtitle = sectionSubtitle(focus);
  if (journey) {
    const at = journeySection(journey);
    return {
      title: `Section ${at.number} · ${at.rank}`,
      goal: goalLine(at.next, at.toGo),
      subtitle,
    };
  }
  if (summary)
    return {
      title: summary.rank,
      goal: goalLine(
        summary.next_rank && summary.next_post !== null
          ? { name: summary.next_rank, post: summary.next_post }
          : null,
        null,
      ),
      subtitle,
    };
  return {
    title: 'Section 1 · Page',
    goal: 'Moves that stop slipping earn stars',
    subtitle,
  };
}

/** Marks where the road passes into the next ward (Outer, Middle, Inner): a
 * divider named for the ward above it, between the last post of one and the
 * first of the next. It is walked once the post below it is done. */
function withGates(nodes: PathNode[]) {
  for (let i = nodes.length - 1; i > 0; i--) {
    const above = nodes[i - 1];
    const below = nodes[i];
    const ward = above?.post?.baileyName;
    if (!ward || !below?.post || below.post.baileyName === ward) continue;
    nodes.splice(
      i,
      0,
      node({
        key: `gate-${above.post?.key}`,
        kind: 'gate',
        state: below.state === 'done' ? 'done' : 'later',
        title: ward,
        detail: null,
      }),
    );
  }
}

/**
 * The path through the wards (docs/specs/2026-10-20-ward-path-design.md): the
 * next posts by place above, the current post's watches (tonight's beacon on
 * the post's first teachable, unheld lesson), then the posts behind (cleared,
 * or blocked and never shown as done). Once tonight is kept the same lesson
 * glows as the extra watch. Rank castles stand between posts.
 */
function wardPathModel(
  state: Exclude<
    TodayState,
    { kind: 'loading' | 'error' | 'new' | 'processing' | 'first' }
  >,
  journey: JourneyMap,
): PathModel | null {
  const layout = wardPathLayout(journey);
  if (!layout) return null;
  const kept = state.kind === 'done';
  const { current, beacon } = layout;
  // A rank castle stands on the road between two posts, where walking past
  // it into the next post is the rank-up: below the marker of the post it
  // opens onto (that post's ward, for the gates).
  const drawn = new Set<string>();
  const castleBefore = (post: PathPost): PathNode[] =>
    layout.castles
      .filter((c) => !c.beyond && c.after === post.index - 1)
      .map((c) => {
        drawn.add(c.key);
        return node({
          key: `castle-${c.key}`,
          kind: 'castle',
          state: c.state === 'reached' ? 'done' : 'later',
          title: c.name,
          castles: [c],
          post,
        });
      });
  const postNode = (post: PathPost): PathNode =>
    node({
      key: postKey(post.key),
      kind: 'post',
      state:
        post.state === 'cleared'
          ? 'done'
          : post.state === 'current'
            ? 'current'
            : 'later',
      title: post.place,
      detail:
        post.state === 'blocked'
          ? `${post.topic} · Coming soon`
          : post.state === 'cleared' && post.clearedOn
            ? `${post.topic} · cleared ${shortDay(post.clearedOn)}`
            : post.topic,
      post,
    });
  // Each post is a section walked upward: its marker where it starts, its
  // nodes above. A post ahead shows its lessons, locked: they are fixed,
  // where the watches it will take are not.
  const nodes: PathNode[] = [];
  for (const post of layout.ahead) {
    nodes.push(
      ...[...post.lessons].reverse().map((l) =>
        node({
          key: `locked-${post.key}-${l.key}`,
          kind: 'locked',
          state: 'later',
          title: l.name,
          detail: l.teachable ? null : 'Coming soon',
          lesson: l,
          post,
        }),
      ),
      postNode(post),
      ...castleBefore(post),
    );
  }
  const lesson =
    (state.kind === 'returning' || state.kind === 'at-risk') &&
    state.start.kind === 'lesson' &&
    state.start.done > 0
      ? { done: state.start.done, total: state.start.total }
      : undefined;
  // The current post is its watches: one node per watch kept since the post
  // was reached, tonight's lit (the beacon's lesson on it), and tomorrow's
  // ahead. Every watch kept is a step; the post clears when its lessons are
  // held, however many watches that takes. A post behind keeps the watches
  // kept while it was current, so the road stays one winding walk.
  const { review } = state;
  const map = journeyModel(journey, review.day, kept);
  const walked = [...layout.behind, current]
    .filter((p) => p.enteredOn)
    .sort((a, b) => a.index - b.index);
  const postOf = (night: (typeof map.nights)[number]) => {
    if (night.state !== 'kept') return current;
    const date = night.date;
    if (!date) return null;
    return (
      walked.find(
        (p) =>
          p.enteredOn &&
          date >= p.enteredOn &&
          (p.state === 'current' || (!!p.clearedOn && date <= p.clearedOn)),
      ) ?? null
    );
  };
  const extrasOf = (night: (typeof map.nights)[number], post: PathPost) =>
    night.extras
      .map((held, i) =>
        node({
          key: `extra-${night.night}-${i + 1}`,
          kind: 'extraKept',
          state: 'done',
          night: night.night,
          post,
          ...(night.date ? { date: night.date } : {}),
          held,
        }),
      )
      .reverse();
  const watches = new Map<string, PathNode[]>();
  let before = map.earlier;
  for (const night of map.nights) {
    const post = postOf(night);
    if (!post) {
      if (night.state === 'kept') before += 1;
      continue;
    }
    const own = watches.get(post.key) ?? [];
    watches.set(post.key, own);
    const base = {
      key: `night-${night.night}`,
      night: night.night,
      milestone: night.milestone,
      stars: night.stars,
      post,
      ...(night.date ? { date: night.date } : {}),
      ...(night.held ? { held: night.held } : {}),
    };
    if (night.state === 'ahead') {
      if (night.night !== map.tonight + 1) continue;
      own.push(
        node({
          ...base,
          kind: 'tomorrow',
          state: 'later',
          title: tomorrowLine(review.tomorrow_due),
          detail: tomorrowDetail(
            journey.ahead?.find((day) => day.date === night.date),
          ),
        }),
      );
      continue;
    }
    if (night.state === 'tonight') {
      if (kept)
        own.push(
          node({
            key: 'extra',
            kind: 'extra',
            state: 'current',
            title: 'Extra watch',
            detail: beacon?.name ?? 'Optional',
            post,
            ...(beacon ? { lesson: beacon } : {}),
          }),
          ...extrasOf(night, post),
        );
      own.push(
        node({
          ...base,
          kind: 'tonight',
          state: kept ? 'done' : 'current',
          title: kept ? 'Kept tonight' : (beacon?.name ?? 'Tonight’s watch'),
          detail: kept ? null : tonightDetail(state),
          progress: lesson,
          ...(beacon ? { lesson: beacon } : {}),
        }),
      );
      continue;
    }
    own.push(
      ...extrasOf(night, post),
      node({ ...base, kind: 'kept', state: 'done' }),
    );
  }
  const own = watches.get(current.key) ?? [];
  nodes.push(...own, ...castleBefore(current));
  for (const post of layout.behind)
    nodes.push(
      ...(watches.get(post.key) ?? []),
      postNode(post),
      ...castleBefore(post),
    );
  withGates(nodes);
  return {
    nodes,
    current: nodes.find((n) => n.state === 'current') ?? null,
    section: {
      title: `${current.baileyName} · Post ${current.index} · ${layout.rank.name}`,
      goal: current.place,
      topic: `${current.topic} · ${heldLine(current)}`,
      subtitle: current.line ?? current.topic,
    },
    // Above the last post, the keep: Knight III, beyond the posts built.
    later: layout.castles.filter((c) => c.beyond || !drawn.has(c.key)),
    earlier: before,
  };
}

/**
 * The path from the home's state and the journey. With the curriculum
 * (`journey.wards`) it is the path through the wards; without it (an older
 * server, or the journey still loading) the nights. Before tonight is kept,
 * tonight's node is current (the only beacon); once kept it turns green and
 * the extra watch above it is current, over the extra watches kept tonight.
 * Ahead, each night is labelled from the schedule (`/api/journey`'s
 * `ahead`, the cards' due dates); from an older server only tomorrow is,
 * with the moves due then. On the first night the path is its three steps.
 */
export function pathModel(state: TodayState, journey?: JourneyMap): PathModel {
  if (state.kind === 'loading' || state.kind === 'error')
    return { nodes: [], current: null, section: null, later: [], earlier: 0 };
  if (
    state.kind === 'new' ||
    state.kind === 'processing' ||
    state.kind === 'first'
  ) {
    const nodes = firstNight(state);
    const review = state.kind === 'first' ? state.review : undefined;
    return {
      nodes,
      current: nodes.find((n) => n.state === 'current') ?? null,
      section: section(review?.focus, review?.journey, journey),
      later: [],
      earlier: 0,
    };
  }
  const wardPath = journey ? wardPathModel(state, journey) : null;
  if (wardPath) return wardPath;
  const { review } = state;
  const kept = state.kind === 'done';
  const source = journeyOrFallback(review, journey);
  const map = journeyModel(source.journey, review.day, kept);
  const lesson =
    (state.kind === 'returning' || state.kind === 'at-risk') &&
    state.start.kind === 'lesson' &&
    state.start.done > 0
      ? { done: state.start.done, total: state.start.total }
      : undefined;
  const schedule = new Map(
    (source.journey.ahead ?? []).map((day) => [day.date, day]),
  );
  const nodes: PathNode[] = [];
  // Extra watches kept on a night: small green nodes above it, newest first.
  // Without the journey's history, tonight's count from home stands in.
  const extrasOf = (night: (typeof map.nights)[number], tonight: boolean) => {
    const known: (HeldCounts | undefined)[] = source.journey.history
      ? night.extras
      : tonight
        ? Array.from({ length: review.extra_kept ?? 0 }, () => undefined)
        : [];
    return known
      .map((held, i) =>
        node({
          key: `extra-${night.night}-${i + 1}`,
          kind: 'extraKept',
          state: 'done',
          night: night.night,
          ...(night.date ? { date: night.date } : {}),
          ...(held ? { held } : {}),
        }),
      )
      .reverse();
  };
  for (const night of map.nights) {
    const base = {
      night: night.night,
      milestone: night.milestone,
      stars: night.stars,
      castles: night.castles,
      ...(night.date ? { date: night.date } : {}),
    };
    if (night.state === 'ahead') {
      const tomorrow = night.night === map.tonight + 1;
      const day = night.date ? schedule.get(night.date) : undefined;
      const words = !tomorrow && day ? aheadWords(day) : null;
      nodes.push(
        node({
          ...base,
          key: `night-${night.night}`,
          kind: tomorrow ? 'tomorrow' : 'ahead',
          state: 'later',
          title: tomorrow
            ? tomorrowLine(review.tomorrow_due)
            : (words?.title ?? ''),
          detail: tomorrow ? tomorrowDetail(day) : (words?.detail ?? null),
          ...(day ? { ahead: day } : {}),
        }),
      );
      continue;
    }
    if (night.state === 'tonight') {
      // Once kept, the next node lights as an extra watch: soft, no beacon.
      if (kept)
        nodes.push(
          node({
            key: 'extra',
            kind: 'extra',
            state: 'current',
            title: 'Extra watch',
            detail: 'Optional',
          }),
          ...extrasOf(night, true),
        );
      nodes.push(
        node({
          ...base,
          key: `night-${night.night}`,
          kind: 'tonight',
          state: kept ? 'done' : 'current',
          title: kept ? 'Kept tonight' : 'Tonight’s watch',
          detail: kept ? null : tonightDetail(state),
          progress: lesson,
          ...(night.held ? { held: night.held } : {}),
        }),
      );
      continue;
    }
    nodes.push(
      ...extrasOf(night, false),
      node({
        ...base,
        key: `night-${night.night}`,
        kind: 'kept',
        state: 'done',
        ...(night.held ? { held: night.held } : {}),
      }),
    );
  }
  return {
    nodes,
    current: nodes.find((n) => n.state === 'current') ?? null,
    section: section(review.focus, review.journey, journey),
    later: source.real ? map.later : [],
    earlier: map.earlier,
  };
}
