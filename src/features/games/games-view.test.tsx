import { fireEvent, render } from '@testing-library/react-native';
import type { GameSummary } from '../../lib/api/import-contract';
import { GamesView, type GamesViewProps } from './games-view';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ canGoBack: () => true }),
}));
jest.mock('./games-controls', () => jest.requireActual('./games-controls.tsx'));

const game: GameSummary = {
  id: 4,
  opponent: 'Opponent',
  played_at: null,
  speed: 'rapid',
  outcome: 'win',
  analysed: false,
  accuracy: null,
  color: null,
  reviewed_at: null,
};
const props: GamesViewProps = {
  games: [game],
  page: { total: 1, page: 1, page_size: 50, games: [game] },
  filters: { rated: 'all' },
  search: '',
  onSearch: jest.fn(),
  onFilters: jest.fn(),
  onOpenGame: jest.fn(),
  onAccounts: jest.fn(),
  onRetry: jest.fn(),
  onRefresh: jest.fn(),
  onLoadMore: jest.fn(),
};
test('missing analysis or metadata never becomes an accuracy score or a pending lesson', () => {
  const open = jest.fn();
  const view = render(<GamesView {...props} onOpenGame={open} />);
  expect(view.queryByText(/Accuracy/)).toBeNull();
  expect(
    view.queryByRole('button', { name: /Opponent.*To review/ }),
  ).toBeNull();
  expect(view.queryByText('Review')).toBeNull();
  expect(view.getByText('Replay')).toBeTruthy();
  expect(
    view.getByRole('button', { name: /Awaiting analysis · Replay available/ }),
  ).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: /Win, vs Opponent/ }));
  expect(open).toHaveBeenCalledWith(4);
});
test('a reviewed game keeps its saved status in the list', () => {
  const saved = {
    ...game,
    analysed: true,
    color: 'white' as const,
    reviewed_at: '2026-10-12T10:00:00Z',
  };
  const view = render(
    <GamesView
      {...props}
      filters={{ rated: 'all', review_status: 'reviewed' }}
      games={[saved]}
      page={{
        total: 1,
        page: 1,
        page_size: 50,
        games: [saved],
        next_review: { ...saved, id: 5, reviewed_at: null },
      }}
    />,
  );
  expect(
    view.getByRole('button', { name: /vs Opponent.*Reviewed/ }),
  ).toBeTruthy();
});
test('rows show their slips, the scope picks slipped or clean games, and the week card waits for analysis', () => {
  const slipped: GameSummary = {
    ...game,
    analysed: true,
    color: 'white',
    slips: { on_watch: 3, held: 1, stopped: 0 },
  };
  const week = {
    games: 2,
    analysed: 0,
    slipped: 0,
    on_watch: 0,
    held: 0,
    stopped: 0,
  };
  const onFilters = jest.fn();
  const view = render(
    <GamesView
      {...props}
      onFilters={onFilters}
      games={[slipped]}
      page={{ total: 1, page: 1, page_size: 50, games: [slipped], week }}
    />,
  );
  expect(view.getByText('3 on watch')).toBeTruthy();
  // The accessible label keeps the review status beside the slips.
  expect(
    view.getByRole('button', { name: /vs Opponent.*3 on watch, To review/ }),
  ).toBeTruthy();
  expect(view.queryByText(/slipped past you/)).toBeNull();
  fireEvent.press(view.getByRole('radio', { name: 'Show games: Slipped' }));
  expect(onFilters).toHaveBeenLastCalledWith({
    rated: 'all',
    slips: 'slipped',
  });
  fireEvent.press(view.getByRole('radio', { name: 'Show games: Clean' }));
  expect(onFilters).toHaveBeenLastCalledWith({ rated: 'all', slips: 'clean' });
  view.rerender(
    <GamesView
      {...props}
      filters={{ rated: 'all', slips: 'slipped' }}
      onFilters={onFilters}
      games={[slipped]}
      page={{
        total: 1,
        page: 1,
        page_size: 50,
        games: [slipped],
        week: { ...week, analysed: 1, slipped: 4, on_watch: 3, held: 1 },
      }}
    />,
  );
  expect(view.getByText('4 moves slipped past you')).toBeTruthy();
  expect(view.getByText('3 on your watch')).toBeTruthy();
  fireEvent.press(view.getByRole('radio', { name: 'Show games: All' }));
  expect(onFilters).toHaveBeenLastCalledWith({
    rated: 'all',
    slips: undefined,
  });
});
