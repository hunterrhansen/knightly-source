import { useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { SettingsChoiceList, TextField, ToggleGroup } from '../../ui';
import { type GamesControlsProps, scopeOptions } from './games-controls-types';

export function GamesControls({
  search,
  onSearch,
  scope,
  onScope,
  filterCount,
  onFilters,
}: GamesControlsProps) {
  const styles = useStyles();
  const { fontScale, width } = useWindowDimensions();
  const { theme } = useTheme();
  const [filterFocused, setFilterFocused] = useState(false);
  const iconFilter = Platform.OS === 'web';
  return (
    <View style={styles.stack}>
      <View style={styles.searchRow}>
        <TextField
          label="Search opponents or openings"
          hideLabel
          variant="search"
          value={search}
          onChangeText={onSearch}
          accessibilityLabel="Search opponents or openings"
          placeholder="Opponent or opening"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={200}
          returnKeyType="search"
          containerStyle={styles.search}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            filterCount ? `Filters, ${filterCount} active` : 'Filters'
          }
          onPress={onFilters}
          onFocus={() => setFilterFocused(true)}
          onBlur={() => setFilterFocused(false)}
          style={[
            styles.filter,
            iconFilter && styles.iconFilter,
            filterFocused && styles.filterFocused,
          ]}
        >
          {iconFilter ? (
            <>
              <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
                <Path
                  d="M3 6h18M7 12h10M10 18h4"
                  fill="none"
                  stroke={theme.colors.brandText}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
              {filterCount > 0 && (
                <Text style={styles.filterLabel}>{filterCount}</Text>
              )}
            </>
          ) : (
            <Text style={styles.filterLabel}>
              {filterCount ? `Filters (${filterCount})` : 'Filters'}
            </Text>
          )}
        </Pressable>
      </View>
      {fontScale >= 1.4 || width < 360 ? (
        <SettingsChoiceList
          title="Show games"
          value={scope}
          options={scopeOptions}
          onChange={onScope}
          hideHeading
        />
      ) : (
        <ToggleGroup
          fullWidth
          label="Show games"
          value={scope}
          options={scopeOptions}
          onChange={onScope}
        />
      )}
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  stack: { gap: theme.spacing.sm },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  search: {
    flex: 1,
    minWidth: 160,
  },
  filter: {
    minHeight: theme.layout.minControl,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconFilter: {
    minWidth: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterFocused: { borderColor: theme.colors.focus },
  filterLabel: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    color: theme.colors.brandText,
  },
}));
