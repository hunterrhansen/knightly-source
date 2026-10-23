import { createAudioPlayer } from 'expo-audio';

jest.mock('../../../assets/audio/coin.wav', () => 'coin');

type Listener = (status: { isLoaded: boolean }) => void;
type FakePlayer = {
  isLoaded: boolean;
  currentTime: number;
  play: jest.Mock;
  seekTo: jest.Mock;
  listeners: Listener[];
};

// Players start unloaded, as a freshly created native player does.
function fakePlayers() {
  const made: FakePlayer[] = [];
  jest.mocked(createAudioPlayer).mockImplementation(() => {
    const player: FakePlayer = {
      isLoaded: false,
      currentTime: 0,
      play: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      listeners: [],
    };
    made.push(player);
    return Object.assign(player, {
      addListener: (_event: string, listener: Listener) => {
        player.listeners.push(listener);
        return { remove: () => {} };
      },
    }) as never;
  });
  return made;
}

const load = (player: FakePlayer) => {
  player.isLoaded = true;
  for (const listener of player.listeners) listener({ isLoaded: true });
};

const coinPlayer = (made: FakePlayer[]) =>
  made[
    jest
      .mocked(createAudioPlayer)
      .mock.calls.findIndex(([source]) => source === 'coin')
  ];

function freshPlaySound() {
  let playSound!: typeof import('./sounds').playSound;
  jest.isolateModules(() => {
    ({ playSound } = require('./sounds'));
  });
  return playSound;
}

beforeEach(() => jest.clearAllMocks());

test('a sound asked for before its file has loaded plays once, when it loads', () => {
  const made = fakePlayers();
  const playSound = freshPlaySound();
  playSound('coin', 'on');
  playSound('coin', 'on');
  const coin = coinPlayer(made);
  expect(coin).toBeDefined();
  // A native player told to play before loading stays silent.
  expect(coin?.play).not.toHaveBeenCalled();
  if (coin) load(coin);
  expect(coin?.play).toHaveBeenCalledTimes(1);
});

test('a sound that already played rewinds fully before it plays again', async () => {
  const made = fakePlayers();
  const playSound = freshPlaySound();
  playSound('coin', 'on');
  const coin = coinPlayer(made);
  if (!coin) throw new Error('no coin player');
  load(coin);
  coin.currentTime = 0.4;
  let rewound!: () => void;
  coin.seekTo.mockImplementationOnce(
    () => new Promise<void>((resolve) => (rewound = resolve)),
  );
  playSound('coin', 'on');
  // Playing before the rewind lands starts at the end: silence.
  expect(coin.play).toHaveBeenCalledTimes(1);
  rewound();
  await Promise.resolve();
  expect(coin.play).toHaveBeenCalledTimes(2);
});
