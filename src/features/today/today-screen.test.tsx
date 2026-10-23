import { fireEvent, render, screen } from '@testing-library/react-native';
import { firstNights, scheduled } from './journey-samples';
import type { KeptNightResource, TodayLearnMore } from './node-card';
import { NodeView } from './node-view';
import { sampleTonight, todaySamples } from './today-samples';
import { TodayScreen } from './today-screen';
import type { TodayState } from './today-state';

jest.mock('expo-router', () => ({
  // The native header draws a custom title view in the title's place.
  Stack: {
    Screen: ({
      options,
    }: {
      options?: { headerTitle?: string | (() => React.ReactNode) };
    }) =>
      typeof options?.headerTitle === 'function' ? options.headerTitle() : null,
  },
  useRouter: () => ({ canGoBack: () => true }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const actions = () => ({
  open: jest.fn(),
  connectGames: jest.fn(),
  retry: jest.fn(),
});

/** The path draws once it knows its size. */
function layOut() {
  fireEvent(screen.getByTestId('home-path'), 'layout', {
    nativeEvent: { layout: { width: 360, height: 640, x: 0, y: 0 } },
  });
}

function show(state: TodayState, act = actions(), journey = firstNights) {
  render(<TodayScreen state={state} actions={act} journey={journey} />);
  layOut();
  return act;
}

/** Taps a node on the path, which opens the node screen's address, then shows
 * that screen's card as the sheet would. Returns the card's actions. */
function openCard(
  state: TodayState,
  node: string | RegExp,
  learnMore?: TodayLearnMore,
  journey = firstNights,
  night?: KeptNightResource,
) {
  const path = show(state, actions(), journey);
  fireEvent.press(screen.getByRole('button', { name: node }));
  const href: string = path.open.mock.calls.at(-1)?.[0];
  expect(href).toMatch(/^\/node\?(key|castle)=/);
  const params = new URLSearchParams(href.split('?')[1]);
  screen.unmount();
  const card = actions();
  render(
    <NodeView
      cardKey={params.get('key') ?? undefined}
      castle={params.get('castle') ?? undefined}
      state={state}
      journey={journey}
      tonight={sampleTonight}
      learnMore={learnMore}
      night={night}
      actions={card}
      onClose={() => {}}
    />,
  );
  return card;
}

test('tonight’s node opens its card as the node screen, whose one button starts the watch with the slipped move named', () => {
  show(todaySamples.Ready);
  expect(screen.getByText('Section 1 · Page')).toBeTruthy();
  screen.unmount();
  const act = openCard(todaySamples.Ready, /^Tonight, night 5\./);
  expect(
    screen.getByLabelText('Fork · Nf5. vs dragonfly88 · yesterday. New'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start watch' }));
  expect(act.open).toHaveBeenCalledWith('/practice?mode=lesson');
});

test('a newly analysed game’s slips lead tonight’s card, which starts the watch or replays the game', () => {
  const ready = todaySamples.Ready;
  if (ready.kind !== 'ready') throw new Error('sample');
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const state: TodayState = {
    ...ready,
    review: {
      ...ready.review,
      tonight: {
        slipped_recent: 1,
        cards: [],
        remaining: 7,
        game: {
          id: 42,
          opponent: 'dragonfly88',
          played_at: yesterday,
          slipped: 1,
        },
      },
    },
  };
  const act = openCard(state, /^Tonight, night 5\./);
  expect(screen.getByText('Your game vs dragonfly88 last night')).toBeTruthy();
  expect(
    screen.getByText('A move slipped past you. It joins tonight’s watch.'),
  ).toBeTruthy();
  expect(
    screen.getByLabelText('Fork · Nf5. vs dragonfly88 · yesterday. New'),
  ).toBeTruthy();
  expect(screen.getByText('+ 6 moves you’re keeping hold of')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Replay the whole game' }),
  );
  expect(act.open).toHaveBeenLastCalledWith('/review/42');
  fireEvent.press(screen.getByRole('button', { name: 'Start watch' }));
  expect(act.open).toHaveBeenLastCalledWith('/practice?mode=lesson');
});

test('at risk, tonight’s card saves the streak; returning, it continues the watch', () => {
  for (const [name, button] of [
    ['At risk', 'Save my streak'],
    ['Returning', 'Continue watch'],
  ] as const) {
    const act = openCard(todaySamples[name], /^Tonight, night 5\./);
    fireEvent.press(screen.getByRole('button', { name: button }));
    expect(act.open).toHaveBeenCalledWith('/practice?mode=lesson');
    screen.unmount();
  }
});

test('once kept, the night says you can stop, and the extra watch above it opens practice from the wall', () => {
  // The journey has four nights kept all time; the streak is 13 in a row.
  show(todaySamples.Done);
  expect(screen.getByText('Night 4 kept · 13 in a row')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByText(/Night 4 kept/)).toBeNull();
  screen.unmount();
  // Tonight's node holds how it went, under the same all-time night.
  openCard(todaySamples.Done, /^Tonight, night 4, kept/);
  expect(screen.getByText('Night 4 kept')).toBeTruthy();
  expect(
    screen.getByText('13 in a row · Good night, knight. You can stop here.'),
  ).toBeTruthy();
  expect(screen.getByText('9 moves held')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: /^(Start|Continue) watch$/ }),
  ).toBeNull();
  screen.unmount();
  const act = openCard(todaySamples.Done, /^Extra watch/);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  expect(act.open).toHaveBeenCalledWith('/practice?mode=extra');
});

test('the kept night is the all-time night, never the streak’s count, even before the journey loads', () => {
  // 17 nights kept all time, 13 of them in a row: night 17, not night 13.
  render(<TodayScreen state={todaySamples.Done} actions={actions()} />);
  layOut();
  expect(screen.getByText('Night 17 kept · 13 in a row')).toBeTruthy();
  expect(screen.queryByText(/Night 13/)).toBeNull();
});

test('tomorrow’s node says what is due, and asks for a watch time only once tonight is kept', () => {
  const noWatch = (state: TodayState) =>
    'review' in state
      ? { ...state, review: { ...state.review, watch: null } }
      : state;
  openCard(noWatch(todaySamples.Ready), 'Tomorrow · 6 due');
  expect(screen.getByText('6 moves due, plus your next game')).toBeTruthy();
  expect(screen.queryByText('Choose a time for tomorrow')).toBeNull();
  screen.unmount();
  const act = openCard(noWatch(todaySamples.Done), 'Tomorrow · 6 due');
  fireEvent.press(
    screen.getByRole('button', { name: 'Choose a time for tomorrow' }),
  );
  expect(act.open).toHaveBeenCalledWith('/watch');
});

test('a night ahead opens the moves the schedule returns then, and which of them could stop slipping', () => {
  openCard(
    todaySamples.Ready,
    'Sat · Qd4’s last check. 3 due',
    undefined,
    scheduled,
  );
  expect(screen.getByText('3 moves come back')).toBeTruthy();
  expect(
    screen.getByText(
      'One could stop slipping: a Good answer that night is its last check.',
    ),
  ).toBeTruthy();
  expect(
    screen.getByLabelText(
      'Missed threat · Qd4. vs kd_88 · held 3 times. Last check',
    ),
  ).toBeTruthy();
  expect(
    screen.getByLabelText('Your move 16 · h3. vs kd_88 · not held yet'),
  ).toBeTruthy();
});

test('a kept night’s card says what it held and, once loaded, where each of its moves stands now', () => {
  // Before its moves load, the night's counts from the journey.
  openCard(todaySamples.Ready, /^Night 3, kept/, undefined, scheduled);
  expect(screen.getByText('Night 3 kept')).toBeTruthy();
  expect(screen.getByText('8 moves held · 2 slipped past')).toBeTruthy();
  screen.unmount();
  const row = {
    game_id: 7,
    san: 'Nf5',
    label: 'Fork',
    opponent: 'kd_88',
    color: 'white' as const,
    fen: 'r4rk1/pp3ppp/2n1b3/3q4/3N4/2P1B3/PP3PPP/R2Q1RK1 w - - 0 14',
  };
  openCard(todaySamples.Ready, /^Night 3, kept/, undefined, scheduled, {
    data: {
      date: '2026-10-12',
      night: 3,
      held: 2,
      slipped: 1,
      stopped: 1,
      moves: [
        { ...row, ply: 21, held_then: true, state: 'stopped', due: null },
        {
          ...row,
          ply: 23,
          held_then: true,
          state: 'held',
          due: '2026-10-16',
        },
        {
          ...row,
          ply: 25,
          held_then: false,
          state: 'on_watch',
          due: '2026-10-14',
        },
      ],
    },
  });
  expect(
    screen.getByText('2 moves held · 1 slipped past · 1 stopped slipping'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Fork · Nf5. Stopped slipping')).toBeTruthy();
  expect(screen.getByLabelText('Fork · Nf5. Held · back Fri')).toBeTruthy();
  expect(screen.getByLabelText('Fork · Nf5. Back tonight')).toBeTruthy();
});

test('the first night leads to connecting games, a puzzle while analysis runs, then the first watch', () => {
  const fresh = openCard(todaySamples.New, /^Connect your games/);
  fireEvent.press(screen.getByRole('button', { name: 'Connect your games' }));
  expect(fresh.connectGames).toHaveBeenCalledTimes(1);
  screen.unmount();
  const waiting = openCard(
    todaySamples.Analyzing,
    'Finding moves that slipped. 12 of 20 games checked',
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Try a puzzle while you wait' }),
  );
  expect(waiting.open).toHaveBeenCalledWith('/practice?mode=lesson');
  screen.unmount();
  const ready = openCard(todaySamples['First night'], /^Your first watch/);
  fireEvent.press(screen.getByRole('button', { name: 'Start first watch' }));
  expect(ready.open).toHaveBeenCalledWith('/practice?mode=lesson');
});

test('the side tiles open Games, badged with the new games that slipped, and Progress', () => {
  const ready = todaySamples.Ready;
  if (ready.kind !== 'ready') throw new Error('sample');
  const act = show({
    ...ready,
    review: { ...ready.review, new_games_slipped: 2 },
  });
  fireEvent.press(
    screen.getByRole('button', { name: 'Games, 2 new games with slips' }),
  );
  expect(act.open).toHaveBeenLastCalledWith('/games');
  fireEvent.press(screen.getByRole('button', { name: 'Progress' }));
  expect(act.open).toHaveBeenLastCalledWith('/progress');
  screen.unmount();
  // No new game with slips (or an older server): no badge.
  show(todaySamples.Ready);
  expect(screen.getByRole('button', { name: 'Games' })).toBeTruthy();
});

test('the rank chip in the header opens Progress', () => {
  const act = show(todaySamples.Ready);
  fireEvent.press(
    screen.getByRole('button', { name: 'Rank Page, 0 stars. Opens Progress' }),
  );
  expect(act.open).toHaveBeenCalledWith('/progress');
});

test('with today’s practice finished, the extra watch adds new positions only when asked, else the night simply ends', () => {
  const onPress = jest.fn();
  openCard(todaySamples['All done'], /^Extra watch/, {
    onPress,
    busy: false,
  });
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  screen.unmount();
  openCard(todaySamples['All done'], /^Extra watch/);
  expect(screen.getByText('Nothing more tonight')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
});
