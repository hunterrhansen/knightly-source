import { useState } from 'react';
import { Text, View } from 'react-native';
import type { GameSummary } from '../../lib/api/import-contract';
import type { GameFilters } from '../../lib/api/progress-contract';
import { ListItem, useFoundationStyles } from '../../ui';
import { GamesView } from './games-view';

function played(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 14, 0, 0);
  return date.toISOString();
}
const samples: GameSummary[] = [
  {
    id: 1,
    opponent: 'may-be-ankit',
    opponent_rating: 913,
    played_at: played(0, 14),
    speed: 'rapid',
    time_control: '600',
    color: 'white',
    outcome: 'win',
    opening: 'Queen’s Pawn, Accelerated London',
    eco: 'D02',
    accuracy: 94.7,
    analysed: true,
    reviewed_at: null,
    slips: { on_watch: 0, held: 0, stopped: 0 },
  },
  {
    id: 2,
    opponent: 'Holarmeede',
    opponent_rating: 922,
    played_at: played(0, 13),
    speed: 'rapid',
    time_control: '600+5',
    color: 'black',
    outcome: 'loss',
    opening: 'Mieses Opening',
    eco: 'A00',
    accuracy: 93.9,
    analysed: true,
    reviewed_at: null,
    slips: { on_watch: 3, held: 1, stopped: 0 },
  },
  {
    id: 3,
    opponent: 'Chess0018118',
    opponent_rating: 910,
    played_at: played(1, 18),
    speed: 'blitz',
    time_control: '300',
    color: 'white',
    outcome: 'win',
    opening: 'Sicilian, Accelerated Dragon',
    eco: 'B34',
    accuracy: 86.0,
    analysed: true,
    reviewed_at: played(0, 11),
    slips: { on_watch: 0, held: 2, stopped: 1 },
  },
  {
    id: 4,
    opponent: '56lvl',
    opponent_rating: 858,
    played_at: played(1, 17),
    speed: 'rapid',
    time_control: '600',
    color: 'black',
    outcome: 'draw',
    opening: 'Queen’s Pawn, Accelerated London',
    eco: 'D02',
    accuracy: null,
    analysed: false,
    reviewed_at: null,
    slips: null,
  },
  {
    id: 5,
    opponent: 'Adwik_IronMan123',
    opponent_rating: 929,
    played_at: played(2, 17),
    speed: 'rapid',
    time_control: '600',
    color: 'white',
    outcome: 'win',
    opening: 'Alapin Sicilian',
    eco: 'B22',
    accuracy: 77.7,
    analysed: true,
    reviewed_at: null,
    slips: { on_watch: 0, held: 0, stopped: 1 },
  },
];
export function GamesPreview({
  state = 'populated',
}: {
  state?: 'populated' | 'unlinked' | 'caught-up' | 'loading' | 'error';
}) {
  const foundationStyles = useFoundationStyles();
  const [filters, setFilters] = useState<GameFilters>({
    rated: 'all',
    ...(state === 'caught-up' ? { review_status: 'to_review' } : {}),
  });
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(4);
  const [selected, setSelected] = useState<string>();
  const all = ['unlinked', 'loading'].includes(state)
    ? []
    : samples.map((game) =>
        state === 'caught-up' && game.analysed
          ? { ...game, reviewed_at: played(0, 11) }
          : game,
      );
  const matching = all.filter(
    (game) =>
      (!search ||
        `${game.opponent} ${game.opening} ${game.eco}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!filters.result || game.outcome === filters.result) &&
      (!filters.speed || game.speed === filters.speed) &&
      (!filters.color || game.color === filters.color) &&
      (!filters.kpi ||
        ((filters.kpi === 'blunders' || filters.kpi === 'thrown') &&
          game.id === 2)),
  );
  const pending = matching.filter(
    (game) => game.analysed && game.color && !game.reviewed_at,
  );
  const slipped = (game: GameSummary) =>
    !!game.slips &&
    game.slips.on_watch + game.slips.held + game.slips.stopped > 0;
  const visible = matching.filter(
    (game) =>
      (filters.review_status === 'reviewed'
        ? !!game.reviewed_at
        : filters.review_status === 'to_review'
          ? pending.includes(game)
          : true) &&
      (filters.slips === 'slipped'
        ? slipped(game)
        : filters.slips === 'clean'
          ? !!game.slips && !slipped(game)
          : true),
  );
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={[
          foundationStyles.quiet,
          { paddingHorizontal: 16, paddingVertical: 8 },
        ]}
      >
        Sample games · Preview only
      </Text>
      {selected && (
        <View>
          <Text style={foundationStyles.quiet}>
            {selected} · Preview only; no progress is saved.
          </Text>
          <ListItem
            label="Return to library"
            onPress={() => setSelected(undefined)}
          />
        </View>
      )}
      <GamesView
        games={visible.slice(0, limit)}
        page={
          state === 'loading'
            ? undefined
            : {
                total: visible.length,
                page: 1,
                page_size: 4,
                games: visible.slice(0, limit),
                next_review: pending[0] ?? null,
                week: all.length
                  ? {
                      games: 5,
                      analysed: 4,
                      slipped: 8,
                      on_watch: 3,
                      held: 3,
                      stopped: 2,
                    }
                  : undefined,
                review_counts: {
                  all: matching.length,
                  to_review: pending.length,
                  reviewed: matching.filter((game) => game.reviewed_at).length,
                },
              }
        }
        filters={filters}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setFilters((previous) => ({ ...previous, q: value || undefined }));
          setLimit(4);
        }}
        onFilters={(value) => {
          setFilters(value);
          setSearch(value.q ?? '');
          setLimit(4);
        }}
        onOpenGame={(id) => setSelected(`Sample game ${id} selected`)}
        onAccounts={() => setSelected('Connected account settings selected')}
        connected={state !== 'unlinked'}
        loading={state === 'loading'}
        error={
          state === 'error'
            ? 'Could not refresh games. Your existing history is kept.'
            : undefined
        }
        hasMore={limit < visible.length}
        onLoadMore={() => setLimit(all.length)}
        onRefresh={() => {}}
        onRetry={() => {}}
      />
    </View>
  );
}
