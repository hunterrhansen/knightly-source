import type { GamesScope } from './games-presentation';

export type GamesControlsProps = {
  search: string;
  onSearch: (value: string) => void;
  scope: GamesScope;
  onScope: (value: GamesScope) => void;
  filterCount: number;
  onFilters: () => void;
};
export const scopeOptions = [
  { value: 'all', label: 'All' },
  { value: 'slipped', label: 'Slipped' },
  { value: 'clean', label: 'Clean' },
] as const;
