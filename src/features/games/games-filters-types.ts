import type { GamesFilterDraft } from './games-presentation';
export type GamesFiltersProps = {
  value: GamesFilterDraft;
  onApply: (value: GamesFilterDraft) => void;
  onCancel: () => void;
};
