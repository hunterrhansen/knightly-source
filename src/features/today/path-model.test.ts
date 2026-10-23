import type { JourneyMap } from '../../lib/api/journey-contract';
import { climbing, firstNights, noNights, scheduled } from './journey-samples';
import { type PathModel, pathModel } from './path-model';
import { todaySamples } from './today-samples';
import type { TodayState } from './today-state';

const currents = (model: PathModel) =>
  model.nodes.filter((node) => node.state === 'current');
const indexOf = (model: PathModel, kind: string) =>
  model.nodes.findIndex((node) => node.kind === kind);
const withReview = (
  state: TodayState,
  over: Partial<Extract<TodayState, { review: unknown }>['review']>,
): TodayState =>
  'review' in state
    ? { ...state, review: { ...state.review, ...over } }
    : state;

test('before tonight is kept, tonight is the one current node and tomorrow says what is due', () => {
  // Four nights kept: tonight is night 5.
  const ready = pathModel(todaySamples.Ready, firstNights);
  expect(currents(ready)).toHaveLength(1);
  expect(ready.current).toMatchObject({
    kind: 'tonight',
    night: 5,
    title: 'Tonight’s watch',
    detail: 'About 5 min',
  });
  expect(ready.current?.progress).toBeUndefined();
  const tomorrow = ready.nodes[indexOf(ready, 'tonight') - 1];
  expect(tomorrow).toMatchObject({ kind: 'tomorrow', night: 6 });
  expect(tomorrow?.title).toBe('Tomorrow · 6 due');
  expect(ready.nodes.some((node) => node.kind === 'extra')).toBe(false);
  // Under way, tonight carries the lesson's progress as its ring.
  const returning = pathModel(todaySamples.Returning, firstNights);
  expect(returning.current).toMatchObject({
    kind: 'tonight',
    detail: '4 of 10 · about 3 min',
    progress: { done: 4, total: 10 },
  });
});

test('once tonight is kept it turns green and the extra watch above it is current', () => {
  // The kept night is the fourth: tonight, then the extra watch, then tomorrow.
  const kept = pathModel(todaySamples.Done, firstNights);
  expect(currents(kept)).toHaveLength(1);
  expect(kept.current).toMatchObject({ kind: 'extra', title: 'Extra watch' });
  const tonight = indexOf(kept, 'tonight');
  expect(kept.nodes[tonight]).toMatchObject({
    state: 'done',
    night: 4,
    title: 'Kept tonight',
  });
  expect(indexOf(kept, 'extra')).toBe(tonight - 1);
  expect(indexOf(kept, 'tomorrow')).toBe(tonight - 2);
  expect(kept.nodes[tonight - 2]?.night).toBe(5);
});

test('before any night is kept, the path is the first night’s three steps', () => {
  const kinds = (model: PathModel) => model.nodes.map((node) => node.kind);
  const fresh = pathModel(todaySamples.New);
  expect(kinds(fresh)).toEqual(['firstWatch', 'finding', 'connect']);
  expect(fresh.current?.kind).toBe('connect');
  const analysing = pathModel(todaySamples.Analyzing);
  expect(analysing.current).toMatchObject({
    kind: 'finding',
    detail: '12 of 20 games checked',
  });
  const first = pathModel(todaySamples['First night']);
  expect(first.current).toMatchObject({
    kind: 'firstWatch',
    title: 'Your first watch',
  });
  expect(first.nodes.filter((node) => node.state === 'done')).toHaveLength(2);
  // Before the first watch the first section is Page, Squire I ahead.
  expect(pathModel(todaySamples.New, noNights).section).toMatchObject({
    title: 'Section 1 · Page',
    goal: 'Clear post 3 for Squire I',
  });
  expect(pathModel(todaySamples.Loading).nodes).toEqual([]);
});

test('only real data labels nodes: without the schedule, tomorrow’s count and nothing on the nights after it', () => {
  const none = pathModel(
    withReview(todaySamples.Ready, { tomorrow_due: 0 }),
    firstNights,
  );
  expect(none.nodes.find((node) => node.kind === 'tomorrow')?.title).toBe(
    'Tomorrow · nothing due yet',
  );
  // From a server without the schedule ahead, the nights after tomorrow stay
  // unlabelled rather than guessed.
  const ahead = none.nodes.filter((node) => node.kind === 'ahead');
  expect(ahead.length).toBeGreaterThan(0);
  for (const node of ahead) {
    expect(node.title).toBe('');
    expect(node.detail).toBeNull();
  }
  // Kept nights carry no invented words either.
  for (const node of none.nodes.filter((n) => n.kind === 'kept'))
    expect(node.title).toBe('');
});

const byNight = (model: PathModel, night: number) =>
  model.nodes.find((node) => node.night === night && node.kind !== 'extraKept');

test('nodes ahead are labelled from the schedule’s due dates: returns, last checks and empty nights', () => {
  // Wednesday Oct 14, four nights kept: tonight is 5, Thursday 6.
  const model = pathModel(todaySamples.Ready, scheduled);
  const words = (night: number) => {
    const node = byNight(model, night);
    return [node?.date, node?.title, node?.detail];
  };
  expect(words(6)).toEqual(['2026-10-15', 'Tomorrow · 6 due', null]);
  expect(words(7)).toEqual(['2026-10-16', 'Fri · Nf5 comes back', null]);
  expect(words(8)).toEqual(['2026-10-17', 'Sat · Qd4’s last check', '3 due']);
  expect(words(9)).toEqual(['2026-10-18', 'Sun · nothing due', null]);
  expect(words(10)).toEqual([
    '2026-10-19',
    'Mon · 4 due',
    'Bxf7 and 3 more come back',
  ]);
  // A week ahead, every night from the schedule, and nothing beyond it.
  const ahead = model.nodes.filter((node) => node.kind === 'ahead');
  expect(ahead.map((node) => node.ahead?.date)).toEqual(
    (scheduled.ahead ?? [])
      .slice(1)
      .map((day) => day.date)
      .reverse(),
  );
  // Tomorrow carries its last check when the schedule has one.
  const lastCheckTomorrow: JourneyMap = {
    ...scheduled,
    ahead: (scheduled.ahead ?? []).map((day, i) =>
      i === 0
        ? {
            ...day,
            last_checks: 1,
            moves: day.moves.map((m, j) => ({ ...m, last_check: j === 1 })),
          }
        : day,
    ),
  };
  expect(
    byNight(pathModel(todaySamples.Ready, lastCheckTomorrow), 6)?.detail,
  ).toBe('Re1’s last check');
});

test('with every kept night’s date, stars and extra watches stand on their real nights', () => {
  const star = (earned_on: string, ply: number) => ({
    game_id: 9,
    ply,
    san: 'Nf5',
    label: 'Fork',
    earned_on,
    dimmed: false,
  });
  const journey: JourneyMap = {
    ...scheduled,
    stars: 3,
    // Earned on Oct 11 (no night kept: the night before it, Oct 10, is
    // night 2), on night 3's date, and today (tonight, not yet kept).
    star_list: [
      star('2026-10-11', 21),
      star('2026-10-12', 23),
      star('2026-10-14', 25),
    ],
  };
  const model = pathModel(todaySamples.Ready, journey);
  const starsOn = (night: number) =>
    byNight(model, night)?.stars.map((s) => s.ply);
  expect(starsOn(2)).toEqual([21]);
  expect(starsOn(3)).toEqual([23]);
  expect(starsOn(5)).toEqual([25]);
  expect(byNight(model, 5)?.kind).toBe('tonight');
  // Kept nights carry their dates and what they held.
  expect(byNight(model, 3)).toMatchObject({
    date: '2026-10-12',
    held: { held: 8, slipped: 2, stopped: 0 },
  });
  // Night 4's extra watch is a small node just above it, with what it held.
  const four = model.nodes.findIndex((node) => node.key === 'night-4');
  expect(model.nodes[four - 1]).toMatchObject({
    kind: 'extraKept',
    state: 'done',
    night: 4,
    held: { held: 4, slipped: 1 },
  });
  expect(model.nodes[four - 2]?.key).toBe('night-5');
  // An older server's map spreads the same star between known dates.
  const { history: _, ...older } = journey;
  const spread = pathModel(todaySamples.Ready, older);
  expect(spread.nodes.find((n) => n.key === 'night-3')?.stars[0]?.ply).toBe(21);
});

test('extra watches kept tonight sit between tonight and the next extra watch', () => {
  // Tonight (Oct 14) kept as the fifth night, with two extra watches.
  const keptTonight: JourneyMap = {
    ...scheduled,
    nights: { ...scheduled.nights, total: 5 },
    history: {
      nights: [
        ...(scheduled.history?.nights ?? []),
        { date: '2026-10-14', held: 10, slipped: 0, stopped: 1 },
      ],
      extra: [
        { date: '2026-10-14', held: 5, slipped: 0, stopped: 0 },
        { date: '2026-10-14', held: 3, slipped: 2, stopped: 0 },
      ],
    },
  };
  const done = withReview(todaySamples.Done, { day: '2026-10-14' });
  const model = pathModel(done, keptTonight);
  const tonight = indexOf(model, 'tonight');
  expect(model.nodes[tonight]).toMatchObject({
    night: 5,
    held: { held: 10, stopped: 1 },
  });
  expect(model.nodes.slice(tonight - 3, tonight).map((n) => n.kind)).toEqual([
    'extra',
    'extraKept',
    'extraKept',
  ]);
  // Newest at the top, as the path runs.
  expect(model.nodes[tonight - 2]?.held?.held).toBe(3);
  expect(model.current?.kind).toBe('extra');
  // From an older server, tonight's count from home stands in, unlabelled.
  const older = pathModel(
    withReview(todaySamples.Done, { extra_kept: 2 }),
    firstNights,
  );
  const kept = older.nodes.filter((n) => n.kind === 'extraKept');
  expect(kept).toHaveLength(2);
  expect(kept.every((n) => n.held === undefined)).toBe(true);
});

test('without the journey the path still has the nights kept and the rank from home, but no castles', () => {
  // The sample: 16 nights kept all time (12 of them in a row), so tonight is
  // night 17, never the streak's 13th; Squire II at 23 of 30.
  const model = pathModel(todaySamples.Ready);
  expect(model.current?.night).toBe(17);
  expect(model.nodes.filter((node) => node.kind === 'kept')).toHaveLength(16);
  expect(model.nodes.every((node) => node.castles.length === 0)).toBe(true);
  expect(model.section).toEqual({
    title: 'Squire II',
    goal: 'Clear post 9 for Squire III',
    subtitle: 'Mostly missed threats lately',
  });
});

test('sections are ranks from the journey, ended only by clearing the next castle’s posts', () => {
  const page = pathModel(todaySamples.Ready, firstNights);
  expect(page.section?.title).toBe('Section 1 · Page');
  expect(page.section?.goal).toBe('Clear post 3 for Squire I');
  const squire = pathModel(
    withReview(todaySamples.Ready, { focus: null }),
    climbing,
  );
  expect(squire.section).toEqual({
    title: 'Section 3 · Squire II',
    goal: 'Clear post 9 for Squire III',
    subtitle: 'Your past mistakes',
  });
  // Reached castles stand on kept nights; the next one ahead of tonight.
  const castles = squire.nodes.flatMap((node) =>
    node.castles.map((castle) => ({ castle, node })),
  );
  const next = castles.find(({ castle }) => castle.name === 'Squire III');
  expect(next?.castle).toMatchObject({ state: 'next', after: 9, toGo: null });
  expect(next?.node.state).toBe('later');
  for (const name of ['Page', 'Squire I', 'Squire II'])
    expect(castles.find(({ castle }) => castle.name === name)?.node.kind).toBe(
      'kept',
    );
  expect(squire.later.map((castle) => castle.name)).toEqual([
    'Knight I',
    'Knight II',
    'Knight III',
  ]);
  // Every rank reached: the last section has no posts to go.
  const top: JourneyMap = {
    ...climbing,
    rank: 'Knight III',
    ranks: climbing.ranks.map((rank) => ({
      ...rank,
      reached_on: rank.reached_on ?? '2026-10-13',
    })),
  };
  expect(pathModel(todaySamples.Ready, top).section).toMatchObject({
    title: 'Section 7 · Knight III',
    goal: 'The highest rank',
  });
});
