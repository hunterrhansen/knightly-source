import type { PracticePace } from '../../lib/api/settings-contract';

// New review positions a day (the backend's deck.PACES). Minutes are for a deck a few
// months old, once the reviews each new position brings have built up.
export const practicePaceOptions: readonly Readonly<{
  value: PracticePace;
  label: string;
}>[] = [
  { value: 'light', label: 'Light · 3 new a day, about 10 min' },
  { value: 'standard', label: 'Standard · 5 new a day, about 15 min' },
  { value: 'intense', label: 'Intense · 10 new a day, about 30 min' },
];

export const practicePaceFooter =
  'New positions from your games each day, plus every review that is due. Reviews build up over the first months, so times are estimates.';
