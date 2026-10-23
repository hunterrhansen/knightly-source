import { Fragment, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { GameSummary, GamesPage } from '../../lib/api/import-contract';
import type { GameFilters } from '../../lib/api/progress-contract';
import { createStyles, useTheme } from '../../theme/theme';
import {
  ActionIcon,
  Avatar,
  Button,
  Card,
  ListItem,
  NavigationHeader,
  Screen,
  ScreenContent,
  ScreenHeader,
} from '../../ui';
import { GamesControls } from './games-controls';
import { GamesFilters } from './games-filters';
import {
  filterKeys,
  filterLabel,
  type GamesFilterDraft,
  gameMetadata,
  groupGames,
  resultLabel,
  reviewLabel,
  slipStatus,
  weekSummary,
} from './games-presentation';
import { SlipChip } from './slip-chip';

export type GamesViewProps = {
  games: GameSummary[];
  page?: GamesPage;
  filters: GameFilters;
  search: string;
  onSearch: (value: string) => void;
  onFilters: (value: GameFilters) => void;
  onOpenGame: (id: number) => void;
  onAccounts: () => void;
  connected?: boolean;
  importMessage?: string;
  loading?: boolean;
  refreshing?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error?: string;
  filterError?: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  /** The web's Back, which closes Games; native modals draw their own close. */
  onClose?: () => void;
};

/** An iOS-style list row: result badge, opponent, one line of details, status. */
function GameRow({
  game,
  onPress,
}: {
  game: GameSummary;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const result = resultLabel(game);
  const review = reviewLabel(game);
  const slip = slipStatus(game);
  const accuracy =
    game.accuracy == null ? undefined : `Accuracy ${game.accuracy.toFixed(1)}`;
  const metadata = gameMetadata(game);
  const date = game.played_at ? new Date(game.played_at) : null;
  const time =
    date && Number.isFinite(date.getTime())
      ? date.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;
  const speed = game.speed
    ? game.speed[0]?.toUpperCase() + game.speed.slice(1)
    : null;
  const lines = fontScale >= 1.4 ? undefined : 1;
  const status = game.reviewed_at
    ? 'reviewed'
    : review === 'To review'
      ? 'review'
      : 'replay';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        result,
        `vs ${game.opponent ?? 'Unknown opponent'}`,
        game.opponent_rating == null ? null : `Rating ${game.opponent_rating}`,
        game.opening,
        metadata,
        time,
        accuracy,
        slip?.label,
        review,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={
        game.analysed ? 'Opens game review and replay' : 'Opens game replay'
      }
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.gameRow,
        pressed && styles.pressed,
        focused && styles.focused,
      ]}
    >
      <View
        style={styles.leading}
        accessible={false}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {/* The opponent's own face when Chess.com has one for them (players.py),
            their initial when it doesn't; the result keeps its colour on the pip. */}
        <Avatar
          name={game.opponent ?? '?'}
          uri={game.opponent_avatar ?? undefined}
          size={40}
        />
        <View style={styles.badge(game.outcome)}>
          <Text allowFontScaling={false} style={styles.badgeText(game.outcome)}>
            {game.outcome === 'draw'
              ? 'D'
              : game.outcome === 'win'
                ? 'W'
                : game.outcome === 'loss'
                  ? 'L'
                  : '—'}
          </Text>
        </View>
      </View>
      <View style={styles.gameMain}>
        <Text numberOfLines={lines} style={styles.player}>
          {game.opponent ?? 'Unknown opponent'}
          {game.opponent_rating != null && (
            <Text style={styles.rating}>{`  ${game.opponent_rating}`}</Text>
          )}
        </Text>
        <Text numberOfLines={lines} style={styles.details}>
          {[result, speed, time].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.trailing}>
        {slip ? (
          <SlipChip tone={slip.tone} label={slip.label} />
        ) : status === 'review' ? (
          <Text style={styles.reviewAction}>Review</Text>
        ) : status === 'reviewed' ? (
          <Text style={styles.reviewed}>
            {'✓'}
            {game.accuracy != null ? ` ${game.accuracy.toFixed(1)}` : ''}
          </Text>
        ) : (
          <Text style={styles.details}>Replay</Text>
        )}
      </View>
    </Pressable>
  );
}

/** The last seven days at a glance: games, moves that slipped and where they
 * are on the watch. Absent while none of those games is analysed. */
function WeekCard({ week }: { week: GamesPage['week'] }) {
  const styles = useStyles();
  const summary = weekSummary(week);
  if (!summary) return null;
  return (
    <Card eyebrow={summary.eyebrow} title={summary.title}>
      <View style={styles.weekChips}>
        {summary.chips.map((chip) => (
          <SlipChip key={chip.tone} tone={chip.tone} label={chip.label} />
        ))}
      </View>
    </Card>
  );
}

export function GamesView({
  games,
  page,
  filters,
  search,
  onSearch,
  onFilters,
  onOpenGame,
  onAccounts,
  connected,
  importMessage,
  loading,
  refreshing,
  loadingMore,
  hasMore,
  error,
  filterError,
  onRetry,
  onRefresh,
  onLoadMore,
  onClose,
}: GamesViewProps) {
  const styles = useStyles();
  const { theme } = useTheme();
  const [showFilters, setShowFilters] = useState(false);
  const activeKeys = filterKeys.filter(
    (key) => filters[key] && !(key === 'range' && filters[key] === 'all'),
  );
  const filtered = activeKeys.length > 0 || !!search.trim();
  const groups = groupGames(games);
  function remove(key: keyof GameFilters) {
    onFilters({ ...filters, [key]: undefined });
  }
  function apply(draft: GamesFilterDraft) {
    onFilters({
      q: search.trim() || undefined,
      slips: filters.slips,
      rated: filters.rated,
      ...draft,
    });
    setShowFilters(false);
  }
  return (
    <Screen
      scrollViewProps={{
        contentInsetAdjustmentBehavior:
          Platform.OS === 'web' ? 'never' : 'automatic',
        keyboardDismissMode: 'interactive',
        // SwiftUI hosts own their input taps; RN must not immediately dismiss them.
        keyboardShouldPersistTaps: 'always',
        automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
        refreshControl: (
          <RefreshControl
            refreshing={!!refreshing && !loadingMore && !loading}
            onRefresh={onRefresh}
            tintColor={theme.colors.brandText}
          />
        ),
      }}
    >
      {Platform.OS === 'web' ? (
        <ScreenHeader
          title="Games"
          titleMode="flex"
          startAction={
            onClose && {
              label: 'Back',
              onPress: onClose,
              content: (
                <ActionIcon name="back" color={theme.colors.brandText} />
              ),
            }
          }
        />
      ) : (
        <NavigationHeader title="Games" />
      )}
      <ScreenContent style={styles.content}>
        {filterError && (
          <Text accessibilityRole="alert" style={styles.quiet}>
            Invalid game filters. Showing all games.
          </Text>
        )}
        <WeekCard week={page?.week} />
        <GamesControls
          search={search}
          onSearch={onSearch}
          scope={filters.slips ?? 'all'}
          onScope={(scope) =>
            onFilters({
              ...filters,
              slips: scope === 'all' ? undefined : scope,
            })
          }
          filterCount={activeKeys.length}
          onFilters={() => setShowFilters(true)}
        />
        {(activeKeys.length > 0 || filters.rated === 'rated') && (
          <View style={styles.chips}>
            {filters.rated === 'rated' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove rated games filter"
                onPress={() => onFilters({ ...filters, rated: 'all' })}
                style={styles.chip}
              >
                <Text style={styles.chipLabel}>Rated games ×</Text>
              </Pressable>
            )}
            {activeKeys.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${filterLabel(key, filters[key] ?? '')} filter`}
                onPress={() => remove(key)}
                style={styles.chip}
              >
                <Text style={styles.chipLabel}>
                  {filterLabel(key, filters[key] ?? '')} ×
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.syncRow}>
          <Text style={styles.syncText}>
            {importMessage ??
              (page
                ? `${page.total.toLocaleString()} ${page.total === 1 ? 'game' : 'games'}${refreshing ? ' · Updating…' : ''}`
                : 'Your game history')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onAccounts}
            style={styles.quietAction}
          >
            <Text style={styles.link}>
              {connected === false ? 'Connect Chess.com' : 'Accounts & sync'}
            </Text>
          </Pressable>
        </View>
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator
              color={theme.colors.brandText}
              accessibilityLabel="Loading games"
            />
            <Text style={styles.quiet}>Loading your games…</Text>
          </View>
        )}
        {error && (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.body}>
              {error}
            </Text>
            <ListItem label="Retry games" onPress={onRetry} />
          </View>
        )}
        {page && !games.length && (
          <Card
            title={
              connected === false && !filtered
                ? 'Bring your games to Knightly'
                : filtered
                  ? 'No games match'
                  : filters.slips === 'slipped'
                    ? 'Nothing slipped past you'
                    : filters.slips === 'clean'
                      ? 'No clean games yet'
                      : 'No games here yet'
            }
            description={
              connected === false && !filtered
                ? 'Connect Chess.com to start learning from your games.'
                : filtered
                  ? 'Try another search or clear your filters.'
                  : filters.slips === 'slipped'
                    ? 'No analysed game here has a move that slipped past you.'
                    : filters.slips === 'clean'
                      ? 'Analysed games where nothing slipped past you land here.'
                      : 'Imported games will appear here as they arrive.'
            }
          >
            {connected === false && !filtered ? (
              <Button onPress={onAccounts}>Connect Chess.com</Button>
            ) : filtered || filters.slips ? (
              <ListItem
                label="View all games"
                onPress={() => {
                  onSearch('');
                  onFilters({ rated: 'all' });
                }}
              />
            ) : null}
          </Card>
        )}
        {groups.map((group) => (
          <View key={group.key} style={styles.dayGroup}>
            <Text accessibilityRole="header" style={styles.groupTitle}>
              {group.title}
            </Text>
            {group.games.map((game, index) => (
              <Fragment key={game.id}>
                {index > 0 && (
                  <View pointerEvents="none" style={styles.rowDivider} />
                )}
                <GameRow game={game} onPress={() => onOpenGame(game.id)} />
              </Fragment>
            ))}
          </View>
        ))}
        {hasMore && (
          <ListItem
            label={loadingMore ? 'Loading older games…' : 'Load older games'}
            onPress={onLoadMore}
            disabled={!!loadingMore || !!refreshing}
          />
        )}
        {games.length > 0 && page && (
          <Text style={styles.syncText}>
            {games.length.toLocaleString()} of {page.total.toLocaleString()}{' '}
            games
          </Text>
        )}
        {showFilters && (
          <GamesFilters
            value={{
              speed: filters.speed,
              result: filters.result,
              color: filters.color,
              range: filters.range === 'all' ? undefined : filters.range,
              kpi: filters.kpi,
              review_status: filters.review_status,
            }}
            onApply={apply}
            onCancel={() => setShowFilters(false)}
          />
        )}
      </ScreenContent>
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  content: { gap: theme.spacing.md },
  body: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  quiet: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  chipLabel: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.ink,
  },
  syncRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  syncText: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
    flexShrink: 1,
  },
  quietAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  link: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    color: theme.colors.brandText,
  },
  state: { gap: theme.spacing.sm },
  loading: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  dayGroup: { gap: 0 },
  // Like an iOS plain list: a quiet section title over a full-width line.
  groupTitle: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  // Separators start after the badge, as in Contacts.
  rowDivider: {
    height: 1,
    marginLeft: 40 + 12 + theme.spacing.xs,
    backgroundColor: theme.colors.line,
  },
  leading: { width: 40, height: 40 },
  // The result, on the avatar's corner: the row keeps one 40pt leading column,
  // so the separators still start where they did.
  badge: (outcome: string | null) => ({
    position: 'absolute' as const,
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      outcome === 'win' ? theme.colors.brand : theme.colors.surfaceMuted,
  }),
  badgeText: (outcome: string | null) => ({
    fontFamily: theme.typography.heading,
    fontSize: 11,
    color:
      outcome === 'win'
        ? theme.colors.onBrand
        : outcome === 'loss'
          ? theme.colors.dangerText
          : theme.colors.inkMuted,
  }),
  gameMain: { flex: 1, minWidth: 0, gap: 2 },
  player: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  rating: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
  },
  details: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
  },
  trailing: { alignItems: 'flex-end', maxWidth: '45%' },
  weekChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  reviewAction: {
    fontFamily: theme.typography.bold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.brandText,
  },
  reviewed: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  focused: { borderColor: theme.colors.focus },
}));
