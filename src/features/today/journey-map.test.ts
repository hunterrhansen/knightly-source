import type { JourneyMap } from '../../lib/api/journey-contract';
import {
  journeyModel,
  journeySection,
  LOOKAHEAD,
  type MapCastle,
  nightOn,
} from './journey-map';
import { climbing, firstNights } from './journey-samples';
import { sampleWards } from './ward-samples';

const castles = (journey: JourneyMap, today: string) =>
  journeyModel(journey, today, true).nights.flatMap((night) =>
    night.castles.map((c: MapCastle) => `${c.name}:${c.state}@${night.night}`),
  );

test('a lapse dims a star on the map but keeps the star count, the rank and every castle reached', () => {
  // The server's answer before and after one card lapsed out of long-term
  // memory: the same stars and rank, that star now dimmed.
  const before: JourneyMap = {
    ...climbing,
    dimmed: 0,
    star_list: climbing.star_list.map((star) => ({ ...star, dimmed: false })),
  };
  const lapsed: JourneyMap = {
    ...before,
    dimmed: 1,
    star_list: before.star_list.map((star, i) =>
      i === 20 ? { ...star, dimmed: true } : star,
    ),
  };
  const was = journeyModel(before, '2026-10-16', true);
  const now = journeyModel(lapsed, '2026-10-16', true);
  expect(now.stars).toBe(23);
  expect(now.chip).toBe('Squire II · ★ 23');
  expect(now.chip).toBe(was.chip);
  expect(now.dimmed).toBe(1);
  expect(castles(lapsed, '2026-10-16')).toEqual(castles(before, '2026-10-16'));
  const shown = now.nights.flatMap((night) => night.stars);
  expect(shown).toHaveLength(23);
  expect(shown.filter((star) => star.dimmed)).toHaveLength(1);
});

test('with no star yet the map shows the nights kept, tonight, Page reached and Squire I ahead', () => {
  // Four nights kept, the first on Oct 12; tonight (Oct 16) not yet kept.
  const model = journeyModel(firstNights, '2026-10-16', false);
  expect(model.tonight).toBe(5);
  expect(model.chip).toBe('Page · ★ 0');
  const state = (n: number) =>
    model.nights.find((night) => night.night === n)?.state;
  expect([1, 2, 3, 4].map(state)).toEqual(['kept', 'kept', 'kept', 'kept']);
  expect(state(5)).toBe('tonight');
  expect(state(6)).toBe('ahead');
  expect(model.nights[0]?.night).toBe(5 + LOOKAHEAD);
  // The castle stands at the end of the path and names the post it waits on;
  // without the curriculum there are no posts to count, so no count.
  expect(castles(firstNights, '2026-10-16')).toContain('Page:reached@1');
  const next = model.nights.find((night) => night.castles.length)?.castles;
  expect(next?.[0]).toMatchObject({
    name: 'Squire I',
    state: 'next',
    after: 3,
    toGo: null,
  });
  expect(model.nights[0]?.castles[0]?.name).toBe('Squire I');
  expect(model.nights.some((night) => night.stars.length)).toBe(false);
  expect(model.later.map((c) => c.name)).toEqual([
    'Squire II',
    'Squire III',
    'Knight I',
    'Knight II',
    'Knight III',
  ]);
});

test('tonight, once kept, is the last night kept rather than a new one', () => {
  const model = journeyModel(firstNights, '2026-10-16', true);
  expect(model.tonight).toBe(4);
  const tonight = model.nights.find((night) => night.state === 'tonight');
  expect(tonight).toMatchObject({ night: 4, keptTonight: true });
});

test('the next castle waits on its posts, at the end of the path drawn, and never on stars', () => {
  // Twenty-three stars and still Squire II: the next castle stands at the path's
  // end, however fast the stars come.
  const model = journeyModel(climbing, '2026-10-16', true);
  expect(model.next?.name).toBe('Squire III');
  expect(model.next?.after).toBe(9);
  const at = model.nights.find((n) =>
    n.castles.some((c) => c.state === 'next'),
  );
  expect(at?.night).toBe(model.tonight + LOOKAHEAD);
});

test('a past date lands on the night it fell on between the nights whose dates are known', () => {
  const known = [
    { night: 1, date: '2026-08-10' },
    { night: 7, date: '2026-08-16' },
    { night: 67, date: '2026-10-16' },
  ];
  expect(nightOn('2026-08-13', known, 66)).toBe(4);
  expect(nightOn('2026-08-01', known, 66)).toBe(1);
  // Halfway in days between night 7 and tonight: halfway in nights.
  expect(nightOn('2026-09-15', known, 66)).toBe(37);
  // Never past the nights kept.
  expect(nightOn('2026-10-16', known, 66)).toBe(66);
});

test('a section counts the posts still open before the next castle, a blocked post never among them', () => {
  // At post 4 as a Squire II: posts 4 to 9 stand between the learner and
  // Squire III's castle after post 9.
  expect(journeySection({ ...climbing, wards: sampleWards(4) })).toMatchObject({
    rank: 'Squire II',
    next: { name: 'Squire III', post: 9 },
    toGo: 6,
  });
  // At post 2, the Gatehouse blocked: posts 2 and 3 before Squire I.
  expect(journeySection({ ...firstNights, wards: sampleWards(2) }).toGo).toBe(
    2,
  );
  // Without the curriculum the posts can't be counted.
  expect(journeySection(climbing).toGo).toBeNull();
});
