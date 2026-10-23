import { firstNights, scheduled } from './journey-samples';
import { findCard } from './node-card';
import { comingUp, pathModel, postKey } from './path-model';
import { todaySamples } from './today-samples';
import { lessonDetail, postMoment, postRankLine } from './ward-path';
import { atTheLists, sampleWards } from './ward-samples';

// The ward path (docs/specs/2026-10-20-ward-path-design.md, "Home: the ward
// path" and its Tests).

const node = (model: ReturnType<typeof pathModel>, key: string) =>
  model.nodes.find((n) => n.key === key);

test('tonight’s beacon stands on the current post’s first teachable lesson not yet held', () => {
  const model = pathModel(todaySamples.Ready, atTheLists);
  expect(model.nodes.filter((n) => n.state === 'current')).toHaveLength(1);
  expect(model.current).toMatchObject({
    kind: 'tonight',
    title: 'Double attack with the king in it',
    lesson: { answered: 1, held: false },
  });
  // A lesson with no drills is skipped for the beacon and says so.
  const pin = pathModel(todaySamples.Ready, {
    ...firstNights,
    wards: sampleWards(6, [0, 0]),
  });
  expect(pin.current?.lesson?.key).toBe('pin');
});

test('the current post is its watches: one node per watch kept since it was reached', () => {
  const model = pathModel(todaySamples.Ready, atTheLists);
  const lists = model.nodes.filter((n) => n.post?.key === 'double-attack');
  // Top first: tomorrow, tonight lit, then the Lists' own kept nights (the 13th
  // with its extra watch, the 12th); the nights before Oct 12 are not its.
  expect(lists.map((n) => [n.kind, n.state, n.date ?? null])).toEqual([
    ['tomorrow', 'later', '2026-10-15'],
    ['tonight', 'current', '2026-10-14'],
    ['extraKept', 'done', '2026-10-13'],
    ['kept', 'done', '2026-10-13'],
    ['kept', 'done', '2026-10-12'],
    // Squire I, reached on the way into the Lists.
    ['castle', 'done', null],
  ]);
  expect(model.nodes.some((n) => n.date === '2026-10-10')).toBe(false);
  // Keeping tonight makes it a step: it turns green under a lit extra watch.
  // (Keeping a night adds it to the journey, as the server's refetch does.)
  const kept = pathModel(todaySamples.Done, {
    ...atTheLists,
    nights: { ...atTheLists.nights, total: atTheLists.nights.total + 1 },
  });
  expect(node(kept, 'night-5')).toMatchObject({
    kind: 'tonight',
    state: 'done',
  });
  expect(kept.current?.key).toBe('extra');
});

test('once tonight is kept the same lesson glows as the extra watch', () => {
  const model = pathModel(todaySamples.Done, atTheLists);
  expect(model.current).toMatchObject({
    kind: 'extra',
    lesson: { key: 'double-attack-king' },
  });
});

test('a blocked post is drawn behind, never as cleared or current', () => {
  // A new learner's first current post is the Drawbridge, not index 1.
  const model = pathModel(todaySamples.Ready, {
    ...firstNights,
    wards: sampleWards(2),
  });
  expect(model.section?.goal).toBe('The Drawbridge');
  const gate = node(model, 'post-board-vision');
  expect(gate).toMatchObject({ kind: 'post', state: 'later' });
  expect(gate?.detail).toContain('Coming soon');
  expect(gate?.post?.state).toBe('blocked');
});

test('the banner leads with the place and draws the plain topic under it', () => {
  const model = pathModel(todaySamples.Ready, atTheLists);
  expect(model.section).toMatchObject({
    title: 'Outer Ward · Post 4 · Squire I',
    goal: 'The Lists',
    topic: 'The double attack · 1 of 2 lessons held',
  });
});

test('the road marks the gate into the next ward between its posts, walked once behind', () => {
  const model = pathModel(todaySamples.Ready, {
    ...firstNights,
    wards: sampleWards(8),
  });
  const keys = model.nodes.map((n) => n.key);
  const gate = model.nodes.find(
    (n) => n.kind === 'gate' && n.title === 'Middle Ward',
  );
  // Between the Guardroom (post 7, Middle Ward) with Squire II's castle on
  // the way in, and the Portcullis (post 6).
  expect(gate).toMatchObject({ title: 'Middle Ward', state: 'done' });
  expect(keys.indexOf('castle-squire-2')).toBe(
    keys.indexOf(postKey('remove-the-defender')) + 1,
  );
  expect(keys.indexOf(gate?.key ?? '')).toBe(
    keys.indexOf('castle-squire-2') + 1,
  );
  expect(keys[keys.indexOf(gate?.key ?? '') + 1]).toBe(postKey('the-pin'));
  // The Inner Ward's gate stands ahead, not yet walked.
  expect(
    model.nodes.filter((n) => n.kind === 'gate').map((n) => [n.title, n.state]),
  ).toEqual([
    ['Inner Ward', 'later'],
    ['Middle Ward', 'done'],
  ]);
});

test('the banner’s About opens the current post’s card, which has no marker', () => {
  const model = pathModel(todaySamples.Ready, {
    ...firstNights,
    wards: sampleWards(8),
  });
  const card = findCard(model, { key: postKey('discovered-attack') });
  expect(card).toMatchObject({
    kind: 'node',
    node: { kind: 'post', state: 'current', title: 'The Postern' },
  });
});

test('a rank castle is reached once every post before it is cleared or blocked', () => {
  const model = pathModel(todaySamples.Ready, atTheLists);
  const squire = model.nodes
    .flatMap((n) => n.castles)
    .find((c) => c.key === 'squire-1');
  expect(squire?.state).toBe('reached');
  // Squire II waits on the Lists, the Turret Stair and the Portcullis.
  const next = [...model.nodes.flatMap((n) => n.castles), ...model.later].find(
    (c) => c.key === 'squire-2',
  );
  expect(next).toMatchObject({ state: 'next', toGo: 3 });
});

test('a rank the server has reached by stars is not lost to the posts', () => {
  const model = pathModel(todaySamples.Ready, {
    ...atTheLists,
    ranks: atTheLists.ranks.map((r) =>
      r.key === 'squire-2' ? { ...r, reached_on: '2026-10-01' } : r,
    ),
  });
  expect(model.section?.title).toBe('Outer Ward · Post 4 · Squire II');
});

test('without the curriculum the path is the nights, as before', () => {
  const model = pathModel(todaySamples.Ready, firstNights);
  expect(model.current?.kind).toBe('tonight');
  expect(model.nodes.some((n) => n.kind === 'post' || n.kind === 'gate')).toBe(
    false,
  );
});

test('with the nights off the path, tonight’s card says what comes back when', () => {
  // Tomorrow first, then the nights with something due; empty nights skipped.
  expect(comingUp(6, atTheLists.ahead).map((r) => r.title)).toEqual([
    'Tomorrow · 6 due',
    'Fri · Nf5 comes back',
    'Sat · Qd4’s last check',
    'Mon · 4 due',
  ]);
  expect(comingUp(0, undefined)).toEqual([
    { key: 'tomorrow', title: 'Tomorrow · nothing due yet', detail: null },
  ]);
});

test('Progress names the rank by post and what the next castle waits on', () => {
  expect(postRankLine(atTheLists)).toMatchObject({
    chip: 'Squire I · Post 4',
    next: '3 posts to Squire II',
  });
  expect(postRankLine(firstNights)).toBeNull();
});

test('a post cleared this session is a moment; one first cleared on an earlier day is not', () => {
  const before = { ...firstNights, wards: sampleWards(6, [3, 0]) };
  const after = { ...firstNights, wards: sampleWards(7) };
  const moment = postMoment(before, after, '2026-10-20');
  expect(moment?.cleared.map((p) => p.place)).toEqual(['The Portcullis']);
  expect(moment?.next?.place).toBe('The Guardroom');
  expect(moment?.enteredWard).toBe('Middle Ward');
  expect(moment?.rank?.name).toBe('Squire II');
  // The Portcullis slipped and cleared again: the server's record says it
  // first cleared a week ago, so nothing celebrates twice.
  const again = {
    ...after,
    wards: after.wards.map((w) =>
      w.key === 'the-pin' ? { ...w, cleared_on: '2026-10-13' } : w,
    ),
  };
  expect(postMoment(before, again, '2026-10-20')?.cleared).toEqual([]);
  // Nothing moved: no beat.
  expect(postMoment(before, before, '2026-10-20')).toBeNull();
});

/** The fixture's eighteen posts, then the Keep, the March and the Citadel as
 * the server sends them: posts 19 to 47, ahead. */
const fullWalk = (current: number) => [
  ...sampleWards(current),
  ...Array.from({ length: 29 }, (_, i) => ({
    key: `post-${i + 19}`,
    name: `Post ${i + 19}`,
    index: i + 19,
    state: 'ahead' as const,
    lessons: [
      {
        key: `lesson-${i + 19}`,
        name: `Lesson ${i + 19}`,
        track: 'tactic',
        step: '4',
        held: false,
        solves: 0,
        teachable: true,
      },
    ],
  })),
];

test('the whole walk is drawn: every post ahead with its lessons locked, to the Citadel', () => {
  const model = pathModel(todaySamples.Ready, {
    ...firstNights,
    wards: fullWalk(2),
  });
  const ahead = model.nodes.filter(
    (n) => n.kind === 'post' && n.post?.state === 'ahead',
  );
  // Posts 3 to 47 above the Drawbridge, nearest last; the Gatehouse is behind.
  expect(ahead.map((n) => n.post?.index)).toEqual(
    Array.from({ length: 45 }, (_, i) => 47 - i),
  );
  const locked = model.nodes.filter((n) => n.kind === 'locked');
  expect(locked.length).toBeGreaterThan(60);
  expect(locked.every((n) => n.state === 'later')).toBe(true);
  // Each castle stands on the road just below the post it opens onto (the
  // Lists, post 4, for Squire I; the Keep's first post for Knight III).
  const keys = model.nodes.map((n) => n.key);
  expect(keys.indexOf('castle-squire-1')).toBe(
    keys.indexOf(postKey('double-attack')) + 1,
  );
  expect(keys.indexOf('castle-knight-3')).toBe(
    keys.indexOf(postKey('post-19')) + 1,
  );
  expect(node(model, 'castle-squire-1')).toMatchObject({
    kind: 'castle',
    state: 'later',
  });
  // Every rank on the ladder has its castle; Castellan, after the last post,
  // waits above the end of the walk.
  expect(keys.filter((k) => k.startsWith('castle-'))).toHaveLength(15);
  expect(model.later.map((c) => c.name)).toEqual(['Castellan']);
});

test('a post behind keeps the watches kept while it was current', () => {
  // The Lists was reached Oct 12; the Armoury held the nights before it.
  const wards = sampleWards(4, [3, 1]).map((w) =>
    w.index === 3
      ? { ...w, entered_on: '2026-10-09', cleared_on: '2026-10-11' }
      : w.state === 'current'
        ? { ...w, entered_on: '2026-10-12' }
        : w,
  );
  const model = pathModel(todaySamples.Ready, { ...scheduled, wards });
  const armoury = model.nodes.filter(
    (n) => n.post?.key === 'loose-pieces' && n.kind === 'kept',
  );
  expect(armoury.map((n) => n.date)).toEqual(['2026-10-10', '2026-10-09']);
  // The marker stands below its watches, where the post was entered.
  const keys = model.nodes.map((n) => n.key);
  expect(keys.indexOf(postKey('loose-pieces'))).toBeGreaterThan(
    keys.indexOf(armoury[1]?.key ?? ''),
  );
});

test('a lesson your games keep missing says so, and one your games show needs only a page', () => {
  const lesson = {
    ward: 'pin',
    key: 'pin',
    name: 'The pin',
    track: 'tactic',
    held: false,
    teachable: true,
    answered: 40,
    pageRight: 12,
  };
  expect(
    lessonDetail({
      ...lesson,
      games: { verdict: 'not_yet', found: 6, chances: 20 },
    }),
  ).toBe('Your games: 6 of 20 found, not yet');
  expect(
    lessonDetail({
      ...lesson,
      answered: 5,
      games: { verdict: 'yes', found: 9, chances: 10 },
    }),
  ).toBe('Your games show it · 5 of 12 answered');
});
