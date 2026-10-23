import { useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { ListItem, SettingsChoiceList } from '../../ui';
import { GamesFilterPopup } from './games-filter-popup';
import type { GamesFiltersProps } from './games-filters-types';
import { filterChoices, filterKeys, filterLabel } from './games-presentation';

export function GamesFilters({ value, onApply, onCancel }: GamesFiltersProps) {
  const styles = useStyles();
  const [draft, setDraft] = useState(value);
  const [expanded, setExpanded] = useState<(typeof filterKeys)[number]>();
  const { theme } = useTheme();
  const web = Platform.OS === 'web';
  return (
    <GamesFilterPopup
      onCancel={onCancel}
      onApply={() => onApply(draft)}
      onReset={() => setDraft({})}
    >
      {filterKeys.map((key) => (
        <View key={key} style={web && styles.filterCard}>
          <ListItem
            label={filterChoices[key].title}
            description={filterLabel(key, draft[key] ?? '')}
            onPress={() => setExpanded(expanded === key ? undefined : key)}
            trailing={
              web ? (
                <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
                  <Path
                    d={expanded === key ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
                    fill="none"
                    stroke={theme.colors.inkMuted}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              ) : undefined
            }
          />
          {expanded === key && (
            <SettingsChoiceList
              title={filterChoices[key].title}
              value={draft[key] ?? ''}
              options={filterChoices[key].options}
              onChange={(choice) => {
                setDraft((previous) => ({
                  ...previous,
                  [key]: choice || undefined,
                }));
                setExpanded(undefined);
              }}
              hideHeading
            />
          )}
        </View>
      ))}
    </GamesFilterPopup>
  );
}
const useStyles = createStyles((theme) => ({
  filterCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    overflow: 'hidden',
  },
}));
