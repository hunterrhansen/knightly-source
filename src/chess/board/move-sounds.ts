import { Chess } from 'chess.js';
import { useEffect, useRef } from 'react';
import { playSound, type SoundSetting } from '../../components/ui/sounds';
import type { BoardSound, Transition } from './board.types';

// The shared player lives in components/ui/sounds; its variant picker and
// setting type are re-exported for board callers and tests.
export { pickVariant, type SoundSetting } from '../../components/ui/sounds';

/**
 * Chooses one sound for a move transition. A finished game outranks check,
 * which outranks the move kind; plain moves differ for player and opponent.
 */
export function moveSound(
  transition: Transition,
  fen: string,
): BoardSound | undefined {
  if (!transition.motions.length) return undefined;
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return undefined;
  }
  // A player's answer is judged by the feedback sound, so a mating answer
  // keeps its move's sound; the game-over chime is for games themselves.
  if (chess.isGameOver() && transition.reason !== 'attempt') return 'game-end';
  if (chess.inCheck()) return 'check';
  if (transition.motions.some((motion) => motion.promotedTo)) return 'promote';
  if (transition.motions.length > 1) return 'castle';
  if (transition.capturedSquare) return 'capture';
  return transition.reason === 'opponent' ? 'move-opponent' : 'move-self';
}

const signature = (transition: Transition) =>
  JSON.stringify(transition.motions.map((motion) => [motion.from, motion.to]));

/**
 * Plays once per move transition. A confirmed transition repeating the
 * attempt already heard stays silent, matching its skipped travel.
 */
export function useMoveSounds(
  transition: Transition | undefined,
  fen: string,
  sounds: SoundSetting,
) {
  const heard = useRef<{ ids: string[]; attempt?: string }>({ ids: [] });
  useEffect(() => {
    // Each transition plays once, even when the board shows it again after a
    // newer one (a position's arrival returning while an answer is judged).
    if (!transition || heard.current.ids.includes(transition.id)) return;
    const previousAttempt = heard.current.attempt;
    heard.current = {
      ids: [...heard.current.ids.slice(-31), transition.id],
      attempt:
        transition.reason === 'attempt' ? signature(transition) : undefined,
    };
    if (
      sounds === 'off' ||
      !['attempt', 'confirmed', 'opponent', 'replay'].includes(
        transition.reason,
      ) ||
      (transition.reason === 'confirmed' &&
        previousAttempt === signature(transition))
    )
      return;
    const sound = moveSound(transition, fen);
    if (sound) playSound(sound, sounds);
  }, [transition, fen, sounds]);
}

/**
 * Plays `sound` each time `key` changes to a new defined value after mount,
 * so retained state (for example settled feedback) is not replayed.
 */
export function useEventSound(
  key: string | undefined,
  sound: BoardSound,
  sounds: SoundSetting,
) {
  const previous = useRef(key);
  useEffect(() => {
    if (key === previous.current) return;
    previous.current = key;
    if (key !== undefined) playSound(sound, sounds);
  }, [key, sound, sounds]);
}
