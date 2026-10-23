import type { Preferences } from '../../theme/preferences';

export type AppearanceChoice = keyof Preferences;
type Choice<K extends AppearanceChoice> = Readonly<{
  label: string;
  options: readonly Readonly<{ value: Preferences[K]; label: string }>[];
}>;

export const appearanceChoices: { [K in AppearanceChoice]: Choice<K> } = {
  board: {
    label: 'Board colors',
    options: [
      { value: 'sage', label: 'Sage' },
      { value: 'brown', label: 'Brown' },
      { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' },
      { value: 'calm', label: 'Calm' },
    ],
  },
  pieces: {
    label: 'Pieces',
    options: [
      { value: 'cburnett', label: 'Classic' },
      { value: 'knightly', label: 'Knightly' },
    ],
  },
  coordinates: {
    label: 'Coordinates',
    options: [
      { value: 'inside', label: 'Inside' },
      { value: 'outside', label: 'Outside' },
      { value: 'none', label: 'None' },
    ],
  },
  animation: {
    label: 'Piece animation',
    options: [
      { value: 'medium', label: 'Medium' },
      { value: 'fast', label: 'Fast' },
      { value: 'slow', label: 'Slow' },
      { value: 'natural', label: 'Natural' },
      { value: 'arcade', label: 'Arcade' },
      { value: 'dynamic', label: 'Dynamic' },
      { value: 'none', label: 'None' },
    ],
  },
  legalMoves: {
    label: 'Show legal moves',
    options: [
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ],
  },
  lastMove: {
    label: 'Highlight last move',
    options: [
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ],
  },
  sounds: {
    label: 'Move sounds',
    options: [
      { value: 'on', label: 'Knightly' },
      { value: 'off', label: 'Off' },
    ],
  },
  bestMove: {
    label: 'Best move arrow in reviews',
    options: [
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ],
  },
  weekStart: {
    label: 'Week starts on',
    options: [
      { value: 'sunday', label: 'Sunday' },
      { value: 'monday', label: 'Monday' },
    ],
  },
};
export const displayChoices = ['board', 'weekStart'] as const;
export const boardChoices: readonly AppearanceChoice[] = [
  'pieces',
  'coordinates',
  'animation',
  'legalMoves',
  'lastMove',
  'sounds',
  'bestMove',
];
export function choiceLabel<K extends AppearanceChoice>(
  key: K,
  value: Preferences[K],
) {
  return (
    appearanceChoices[key].options.find((option) => option.value === value)
      ?.label ?? value
  );
}
