import type { Overview } from '../../lib/api/progress-contract';

export type RatingPoint = {
  timestamp: number;
  rating: number;
  opponent: string | null;
};
export type RatingChartProps = {
  data: RatingPoint[];
  /** The game the readout shows; the chart marks it. */
  selected: number;
  onSelect: (index: number) => void;
};

export function ratingPoints(series: Overview['rating_series']): RatingPoint[] {
  return series.map((game) => ({
    timestamp: Date.parse(game.played_at),
    rating: game.rating,
    opponent: game.opponent,
  }));
}
