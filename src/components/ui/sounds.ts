import {
  type AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';

// The app's one audio player: board moves, feedback, coins and UI sounds
// share preloaded players, so no screen holds its own native audio.

type BoardSoundName =
  | 'move-self'
  | 'move-opponent'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'game-end'
  | 'illegal'
  | 'correct'
  | 'incorrect'
  | 'coin'
  | 'coin-bonus';
/** UI sounds that accompany motion (docs/art-direction.md#ui-sound-palette):
 * a card landing pops, a count ticks, and a session or streak ends on a
 * fanfare. */
type UiSound = 'pop' | 'tick' | 'fanfare-short' | 'fanfare';
/** Every sound the app can play. */
export type Sound = BoardSoundName | UiSound;

// The commonest sounds have variants (scripts/generate-board-sounds.mjs).
const sources: Record<Sound, readonly number[]> = {
  'move-self': [
    require('../../../assets/audio/move-self.wav'),
    require('../../../assets/audio/move-self-2.wav'),
    require('../../../assets/audio/move-self-3.wav'),
  ],
  'move-opponent': [
    require('../../../assets/audio/move-opponent.wav'),
    require('../../../assets/audio/move-opponent-2.wav'),
    require('../../../assets/audio/move-opponent-3.wav'),
  ],
  capture: [
    require('../../../assets/audio/capture.wav'),
    require('../../../assets/audio/capture-2.wav'),
  ],
  castle: [require('../../../assets/audio/castle.wav')],
  check: [require('../../../assets/audio/check.wav')],
  promote: [require('../../../assets/audio/promote.wav')],
  'game-end': [require('../../../assets/audio/game-end.wav')],
  illegal: [require('../../../assets/audio/illegal.wav')],
  correct: [require('../../../assets/audio/correct.wav')],
  incorrect: [require('../../../assets/audio/incorrect.wav')],
  coin: [require('../../../assets/audio/coin.wav')],
  'coin-bonus': [require('../../../assets/audio/coin-bonus.wav')],
  pop: [
    require('../../../assets/audio/pop.wav'),
    require('../../../assets/audio/pop-2.wav'),
    require('../../../assets/audio/pop-3.wav'),
  ],
  tick: [require('../../../assets/audio/tick.wav')],
  'fanfare-short': [require('../../../assets/audio/fanfare-short.wav')],
  fanfare: [require('../../../assets/audio/fanfare.wav')],
};

/**
 * Index of the variant to play next out of `count`: random, but never `last`
 * again when there is a choice.
 */
export function pickVariant(
  count: number,
  last: number | undefined,
  random: () => number = Math.random,
): number {
  if (count <= 1) return 0;
  if (last === undefined) return Math.floor(random() * count);
  const index = Math.floor(random() * (count - 1));
  return index >= last ? index + 1 : index;
}

// Shared players: board instances must not each hold native audio resources.
/** The device's move-sound preference. */
export type SoundSetting = 'on' | 'off';
let players: Partial<Record<string, AudioPlayer>> | undefined;
const lastVariant: Partial<Record<Sound, number>> = {};
// Players asked to play before their file loaded; each plays once on load.
const waiting = new Set<AudioPlayer>();
/** Plays one sound now, unless the device's sounds are off. */
export function playSound(sound: Sound, sounds: SoundSetting) {
  play(sound, sounds);
}
/** Creates every player on first use, so each file is loading (or loaded)
 * long before its first cue: a native player told to play before its file
 * loads stays silent. */
function allPlayers() {
  if (players) return players;
  players = {};
  // Board sounds mix with other audio and respect the silent switch.
  void setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
  for (const [sound, variants] of Object.entries(sources))
    variants.forEach((source, variant) => {
      try {
        (players as Record<string, AudioPlayer>)[`${sound}:${variant}`] =
          createAudioPlayer(source);
      } catch {
        // A file that cannot load stays silent; the rest still play.
      }
    });
  return players;
}
/** Starts `player` from the beginning: once it has loaded, and only after a
 * rewind has landed, since playing mid-seek starts from the old position. */
function start(player: AudioPlayer) {
  if (!player.isLoaded) {
    if (waiting.has(player)) return;
    waiting.add(player);
    const subscription = player.addListener(
      'playbackStatusUpdate',
      (status) => {
        if (!status.isLoaded || !waiting.has(player)) return;
        waiting.delete(player);
        subscription.remove();
        start(player);
      },
    );
    return;
  }
  if (player.currentTime > 0)
    void player.seekTo(0).then(
      () => player.play(),
      () => player.play(),
    );
  else player.play();
}
function play(sound: Sound, sounds: SoundSetting) {
  if (sounds === 'off') return;
  try {
    const all = allPlayers();
    const variants = sources[sound];
    const variant = pickVariant(variants.length, lastVariant[sound]);
    lastVariant[sound] = variant;
    const player = all[`${sound}:${variant}`] ?? all[`${sound}:0`];
    if (player) start(player);
  } catch {
    // Sound is an enhancement; unavailable audio never affects board input.
  }
}
