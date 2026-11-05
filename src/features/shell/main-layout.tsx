import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { useTheme } from '../../theme/theme';

// Full-colour Knightly glyphs rendered from KnightlyGlyph (assets/navigation).
// `original` keeps their two-tone colours; the label and the platform indicator
// mark the selected tab.
const icons = {
  '(today)': require('../../../assets/navigation/today.png'),
  games: require('../../../assets/navigation/games.png'),
  progress: require('../../../assets/navigation/progress.png'),
};
export function MainLayout(_props: { preview?: boolean }) {
  const { theme } = useTheme();
  const android = Platform.OS === 'android';
  const tabs = [
    { name: '(today)', label: 'Today' },
    { name: 'games', label: 'Games' },
    { name: 'progress', label: 'Progress' },
  ] as const;
  return (
    <NativeTabs
      tintColor={theme.colors.sky}
      backgroundColor={android ? theme.colors.surface : undefined}
      indicatorColor={`${theme.colors.sky}29`}
      labelVisibilityMode="labeled"
      labelStyle={{
        default: {
          fontFamily: theme.typography.bold,
          fontSize: 11,
          color: theme.colors.inkMuted,
        },
        selected: {
          fontFamily: theme.typography.bold,
          fontSize: 11,
          color: theme.colors.ink,
        },
      }}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon
            src={icons[tab.name]}
            renderingMode="original"
          />
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
