import { renderHook } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';
import { applyMove } from '../move';
import { castleFen, startFen } from '../test-fixtures';
import type { Transition } from './board.types';
import {
  moveSound,
  pickVariant,
  type SoundSetting,
  useEventSound,
  useMoveSounds,
} from './move-sounds';
import { createTransition } from './transition';

// Jest loads every audio file as `1`; name each one so tests can tell sounds apart.
jest.mock('../../../assets/audio/move-self.wav', () => 'move-self');
jest.mock('../../../assets/audio/move-self-2.wav', () => 'move-self-2');
jest.mock('../../../assets/audio/move-self-3.wav', () => 'move-self-3');
jest.mock('../../../assets/audio/move-opponent.wav', () => 'move-opponent');
jest.mock('../../../assets/audio/move-opponent-2.wav', () => 'move-opponent-2');
jest.mock('../../../assets/audio/move-opponent-3.wav', () => 'move-opponent-3');
jest.mock('../../../assets/audio/capture.wav', () => 'capture');
jest.mock('../../../assets/audio/capture-2.wav', () => 'capture-2');
jest.mock('../../../assets/audio/castle.wav', () => 'castle');
jest.mock('../../../assets/audio/check.wav', () => 'check');
jest.mock('../../../assets/audio/promote.wav', () => 'promote');
jest.mock('../../../assets/audio/game-end.wav', () => 'game-end');
jest.mock('../../../assets/audio/illegal.wav', () => 'illegal');
jest.mock('../../../assets/audio/correct.wav', () => 'correct');
jest.mock('../../../assets/audio/incorrect.wav', () => 'incorrect');
jest.mock('../../../assets/audio/coin.wav', () => 'coin');
jest.mock('../../../assets/audio/coin-bonus.wav', () => 'coin-bonus');

const transition = (
  fen: string,
  move: Parameters<typeof applyMove>[1],
  reason: Transition['reason'],
  id: string,
) => {
  const applied = applyMove(fen, move);
  return {
    fen: applied.fen,
    transition: createTransition({ id, positionId: id, reason }, applied),
  };
};
// Record each playback by its asset; shared players persist across tests.
const plays: unknown[] = [];
jest.mocked(createAudioPlayer).mockImplementation(
  (source) =>
    ({
      isLoaded: true,
      currentTime: 0,
      play: () => plays.push(source),
      seekTo: () => Promise.resolve(),
      addListener: () => ({ remove: () => {} }),
    }) as unknown as ReturnType<typeof createAudioPlayer>,
);
beforeEach(() => {
  plays.length = 0;
});
// A played file as its sound's name: variants (`move-self-2`) count as their sound.
const played = () => plays.map((source) => String(source).replace(/-\d$/, ''));

test('each special move has its own sound and check outranks the move kind', () => {
  const capture = transition(
    'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    { from: 'e4', to: 'd5' },
    'confirmed',
    'c',
  );
  const castle = transition(
    castleFen,
    { from: 'e1', to: 'g1' },
    'confirmed',
    'k',
  );
  const promote = transition(
    '7k/P6p/8/8/8/8/7P/K7 w - - 0 1',
    { from: 'a7', to: 'a8', promotion: 'n' },
    'confirmed',
    'p',
  );
  const check = transition(
    '7k/P6p/8/8/8/8/7P/K7 w - - 0 1',
    { from: 'a7', to: 'a8', promotion: 'q' },
    'confirmed',
    'q',
  );
  expect(moveSound(capture.transition, capture.fen)).toBe('capture');
  expect(moveSound(castle.transition, castle.fen)).toBe('castle');
  expect(moveSound(promote.transition, promote.fen)).toBe('promote');
  expect(moveSound(check.transition, check.fen)).toBe('check');
  // Fool's mate: the game end outranks the check it also delivers.
  const mate = transition(
    'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    { from: 'd8', to: 'h4' },
    'opponent',
    'm',
  );
  expect(moveSound(mate.transition, mate.fen)).toBe('game-end');
  expect(
    moveSound(
      createTransition({ id: 'n', positionId: 'n', reason: 'navigation' }),
      startFen,
    ),
  ).toBeUndefined();
});

test('a move is heard once: its confirmation and navigation stay silent', () => {
  const attempt = transition(
    startFen,
    { from: 'e2', to: 'e4' },
    'attempt',
    'a',
  );
  const confirmed = {
    ...attempt.transition,
    id: 'b',
    reason: 'confirmed' as const,
  };
  const reply = transition(
    attempt.fen,
    { from: 'd7', to: 'd5' },
    'opponent',
    'r',
  );
  const { rerender } = renderHook(
    (props: { transition?: Transition; fen: string; sounds: SoundSetting }) =>
      useMoveSounds(props.transition, props.fen, props.sounds),
    { initialProps: { ...attempt, sounds: 'on' as const } },
  );
  rerender({ transition: confirmed, fen: attempt.fen, sounds: 'on' as const });
  rerender({ transition: confirmed, fen: attempt.fen, sounds: 'on' as const });
  rerender({ ...reply, sounds: 'on' as const });
  rerender({
    transition: createTransition({
      id: 'n',
      positionId: 'n',
      reason: 'navigation',
    }),
    fen: startFen,
    sounds: 'on' as const,
  });
  const muted = transition(
    reply.fen,
    { from: 'e4', to: 'd5' },
    'confirmed',
    'm',
  );
  rerender({ ...muted, sounds: 'off' as const });
  expect(played()).toEqual(['move-self', 'move-opponent']);
});

test('event sounds play on each new event, never for state present at mount', () => {
  const { rerender } = renderHook(
    (props: { event?: string; sounds: SoundSetting }) =>
      useEventSound(props.event, 'illegal', props.sounds),
    { initialProps: { event: 'retained', sounds: 'on' as const } },
  );
  rerender({ event: 'retained', sounds: 'on' as const });
  rerender({ event: undefined, sounds: 'on' as const });
  rerender({ event: '1', sounds: 'on' as const });
  rerender({ event: '2', sounds: 'off' as const });
  rerender({ event: '3', sounds: 'on' as const });
  expect(played()).toEqual(['illegal', 'illegal']);
});

test('sound variants are picked at random but never twice in a row', () => {
  expect(pickVariant(1, 0, () => 0.9)).toBe(0);
  expect(pickVariant(3, undefined, () => 0.99)).toBe(2);
  for (const random of [0, 0.4, 0.99])
    for (const last of [0, 1, 2]) {
      const next = pickVariant(3, last, () => random);
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(3);
    }
});

test('a mating answer sounds like the checking move, not the game-over chime', () => {
  // A puzzle answer judged by the feedback sound: the board adds its move only.
  const mate = transition(
    'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    { from: 'd8', to: 'h4' },
    'attempt',
    'a',
  );
  expect(moveSound(mate.transition, mate.fen)).toBe('check');
});
test('a transition that comes back after a newer one is not heard again', () => {
  const setup = transition(
    startFen,
    { from: 'e2', to: 'e4' },
    'opponent',
    'setup',
  );
  const answer = transition(
    setup.fen,
    { from: 'd7', to: 'd5' },
    'attempt',
    'answer',
  );
  const { rerender } = renderHook(
    (props: { transition?: Transition; fen: string; sounds: SoundSetting }) =>
      useMoveSounds(props.transition, props.fen, props.sounds),
    { initialProps: { ...setup, sounds: 'on' as const } },
  );
  rerender({ ...answer, sounds: 'on' as const });
  // The board falls back to the position's arrival while the answer is judged.
  rerender({
    transition: setup.transition,
    fen: answer.fen,
    sounds: 'on' as const,
  });
  expect(played()).toEqual(['move-opponent', 'move-self']);
});
