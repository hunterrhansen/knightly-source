import type { DailyReview, TonightCard } from '../../lib/api/today-contract';
import {
  isLateNight,
  keptLines,
  moreTonight,
  tonightGame,
  tonightHeadline,
  tonightResults,
  tonightRows,
  watchTitle,
} from './tonight';

const at = (hours: number, minutes = 0) =>
  new Date(2026, 9, 18, hours, minutes);

const card = (over: Partial<TonightCard> = {}): TonightCard => ({
  game_id: 7,
  ply: 27,
  san: 'Nf5',
  label: 'Fork',
  opponent: 'kd_88',
  played_at: '2026-10-17T19:30:00',
  chip: 'new',
  color: 'white',
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  ...over,
});

const review = (
  cards: TonightCard[],
  slipped = 0,
  remaining = 0,
): Pick<DailyReview, 'lesson' | 'tonight'> => ({
  lesson: { done: 0, total: 10 },
  tonight: { slipped_recent: slipped, cards, remaining },
});

test('the header says Tonight from 17:00 and Today before', () => {
  expect(watchTitle(at(16, 59))).toBe('Today');
  expect(watchTitle(at(17))).toBe('Tonight');
});

test('the night rule starts at 21:00 and lasts until morning', () => {
  expect(isLateNight(at(20, 59))).toBe(false);
  expect(isLateNight(at(21))).toBe(true);
  expect(isLateNight(at(2))).toBe(true);
  expect(isLateNight(at(9))).toBe(false);
});

test('a move row names the move, its game and where it stands', () => {
  const rows = tonightRows(
    review([
      card(),
      card({ ply: 29, chip: 'again', label: 'Your move 15', san: 'Qd2' }),
      card({ ply: 31, chip: 'almost', opponent: null }),
      card({ ply: 33, chip: null }),
    ]),
    at(20),
  );
  expect(rows[0]).toMatchObject({
    label: 'Fork · Nf5',
    detail: 'vs kd_88 · yesterday',
    chip: 'New',
  });
  expect(rows.map((row) => row.chip)).toEqual([
    'New',
    '2nd look',
    'Almost held',
    null,
  ]);
  expect(rows[1]?.label).toBe('Your move 15 · Qd2');
  expect(rows[2]?.detail).toBe('yesterday');
});

test('a move without a position to draw is left out, and older servers have no rows', () => {
  expect(tonightRows(review([card({ fen: null })]), at(20))).toEqual([]);
  expect(tonightRows({}, at(20))).toEqual([]);
});

test('the headline names new slips by their games’ day, otherwise the moves kept hold of', () => {
  const now = at(20);
  const one = review([card()], 1);
  expect(tonightHeadline(one, tonightRows(one, now)).title).toBe(
    'A move slipped past you yesterday',
  );
  const twoDays = review(
    [card(), card({ ply: 29, played_at: '2026-10-14T19:30:00' })],
    2,
  );
  expect(tonightHeadline(twoDays, tonightRows(twoDays, now)).title).toBe(
    '2 moves slipped past you this week',
  );
  const wednesday = review([card({ played_at: '2026-10-14T19:30:00' })], 1);
  expect(tonightHeadline(wednesday, tonightRows(wednesday, now)).title).toBe(
    'A move slipped past you on Wednesday',
  );
  // More slips than rows: the day of the unseen ones is unknown.
  const more = review([card()], 4);
  expect(tonightHeadline(more, tonightRows(more, now)).title).toBe(
    '4 moves slipped past you this week',
  );
  const none = {
    ...review([card({ chip: 'again' })]),
    lesson: { done: 4, total: 10 },
  };
  expect(tonightHeadline(none, tonightRows(none, now)).title).toBe(
    '6 moves you’re keeping hold of',
  );
});

test('“+ N more” counts the lesson’s items beyond the rows shown', () => {
  expect(moreTonight(review([card(), card({ ply: 29 })], 0, 5), 2)).toBe(5);
  // A row left out (no position) is counted among the rest.
  expect(moreTonight(review([card(), card({ ply: 29 })], 0, 5), 1)).toBe(6);
  expect(moreTonight({ lesson: { done: 2, total: 10 } }, 0)).toBe(8);
});

// Sunday 18 October 2026, evening.
const sunday = at(20);
test('kept results: held, slipped again until the earliest due day, and what stopped slipping', () => {
  const outcome = tonightResults(
    [
      { correct: true, due: '2026-11-20' },
      { correct: false, due: '2026-10-22' },
      { correct: false, due: '2026-10-21' },
      { correct: true, stopped: true, label: 'Loose piece' },
    ],
    sunday,
  );
  expect(keptLines(outcome, 1)).toEqual({
    held: '2 moves held',
    slipped: { title: '2 moves slipped again', detail: 'Back Wednesday' },
    stopped: {
      title: 'Loose piece stopped slipping',
      detail: 'A star relit',
    },
  });
});

test('a slipped move due tomorrow, next week or on an unknown day says so', () => {
  const back = (due: string | null) =>
    keptLines(tonightResults([{ correct: false, due }], sunday), 0).slipped
      ?.detail;
  expect(back('2026-10-19')).toBe('Back tomorrow');
  expect(back('2026-10-28')).toMatch(/^Back Oct 28$/);
  // Older servers send no due day.
  expect(back(null)).toBe('Back on a later watch');
});

test('stopped slipping falls back to the day’s count', () => {
  const none = tonightResults(undefined, sunday);
  expect(keptLines(none, 0)).toEqual({
    held: null,
    slipped: null,
    stopped: null,
  });
  // A puzzle relit two stars without a named answer tonight.
  expect(keptLines(none, 2).stopped).toEqual({
    title: '2 moves stopped slipping',
    detail: '2 stars relit',
  });
  const named = tonightResults(
    [{ correct: true, stopped: true, label: 'Fork' }],
    sunday,
  );
  expect(keptLines(named, 3).stopped).toEqual({
    title: 'Fork and 2 more stopped slipping',
    detail: '3 stars relit',
  });
});

test('a newly analysed game leads tonight’s card by name, joining the watch with a replay link', () => {
  const lead = (slipped: number, played_at: string) => ({
    tonight: {
      slipped_recent: slipped,
      cards: [card()],
      remaining: 4,
      game: { id: 7, opponent: 'kd_88', played_at, slipped },
    },
  });
  expect(tonightGame(lead(2, '2026-10-17T19:30:00'), at(20))).toEqual({
    title: 'Your game vs kd_88 last night',
    coach: '2 moves slipped past you. They join tonight’s watch.',
    replayHref: '/review/7',
  });
  expect(tonightGame(lead(1, '2026-10-18T09:00:00'), at(20))).toMatchObject({
    title: 'Your game vs kd_88 today',
    coach: 'A move slipped past you. It joins tonight’s watch.',
  });
  // No game leading (an older server, or none new): the usual headline.
  expect(tonightGame(review([card()], 1), at(20))).toBeNull();
});
