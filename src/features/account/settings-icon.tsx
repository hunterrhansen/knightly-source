import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';

type SettingsIconName =
  | 'appearance'
  | 'connections'
  | 'reminders'
  | 'updates'
  | 'analysis'
  | 'data'
  | 'privacy'
  | 'sign-out';
/** Decorative accessories; the settings row owns its accessible name and action. */
export function SettingsIcon({ name }: { name: SettingsIconName }) {
  const styles = useStyles();
  const { theme } = useTheme();
  const gold = name === 'appearance' || name === 'analysis';
  const blue = name === 'connections' || name === 'data';
  const danger = name === 'sign-out';
  const background = gold
    ? theme.boardAnnotations.hintGold
    : blue
      ? theme.boardAnnotations.analysis
      : danger
        ? theme.boardAnnotations.danger
        : theme.colors.brand;
  const foreground = gold
    ? theme.boardAnnotations.onHintGold
    : blue || danger
      ? '#ffffff'
      : theme.colors.onBrand;
  const glyphs = {
    appearance: (
      <>
        <Circle cx={12} cy={12} r={4} />
        <Path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    connections: (
      <>
        <Path d="m9 15 6-6m-5-3 2-2a4.2 4.2 0 0 1 6 6l-2 2m-2 6-2 2a4.2 4.2 0 0 1-6-6l2-2" />
      </>
    ),
    reminders: (
      <>
        <Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z" />
        <Path d="M10 21h4" />
      </>
    ),
    updates: (
      <>
        <Path d="M20 8a8 8 0 0 0-13-2L4 9m0-5v5h5M4 16a8 8 0 0 0 13 2l3-3m0 5v-5h-5" />
      </>
    ),
    analysis: (
      <>
        <Path d="M5 20V13h3v7M11 20V8h3v12M17 20V3h3v17" />
      </>
    ),
    data: (
      <>
        <Rect x={4} y={3} width={16} height={18} rx={2} />
        <Path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    privacy: (
      <>
        <Path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z" />
        <Path d="m8 12 3 3 5-6" />
      </>
    ),
    'sign-out': (
      <>
        <Path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
  };
  return (
    <View style={[styles.tile, { backgroundColor: background }]}>
      <Svg
        width={21}
        height={21}
        viewBox="0 0 24 24"
        fill="none"
        stroke={foreground}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyphs[name]}
      </Svg>
    </View>
  );
}
const useStyles = createStyles(() => ({
  tile: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
