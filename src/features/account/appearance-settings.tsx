import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  boardSquareColors,
  type Preferences,
  usePreferences,
} from '../../theme/preferences';
import { createStyles } from '../../theme/theme';
import {
  SettingsNavigationRow,
  SettingsPicker,
  SettingsSection,
} from '../../ui';
import {
  type AppearanceChoice,
  appearanceChoices,
  boardChoices,
  choiceLabel,
  displayChoices,
} from './appearance-choices';

function BoardSwatch({ board }: { board: Preferences['board'] }) {
  const colors = boardSquareColors(board);
  return (
    <Svg aria-hidden width={20} height={20} viewBox="0 0 20 20">
      <Rect width={20} height={20} fill={colors[0]} />
      <Path d="M10 0h10v10H10ZM0 10h10v10H0Z" fill={colors[1]} />
    </Svg>
  );
}
function ChoicePicker<K extends AppearanceChoice>({ choice }: { choice: K }) {
  const { preferences, ready, set } = usePreferences();
  const value = preferences[choice];
  return (
    <SettingsPicker
      label={appearanceChoices[choice].label}
      leading={
        choice === 'board' ? (
          <BoardSwatch board={preferences.board} />
        ) : undefined
      }
      value={value}
      disabled={!ready}
      onChange={(next) => set({ [choice]: next })}
      options={appearanceChoices[choice].options.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
    />
  );
}
export function AppearanceSettings({
  choice,
  onOpenChoice,
}: {
  choice?: string;
  onOpenChoice: (choice: AppearanceChoice) => void;
}) {
  const styles = useStyles();
  const { preferences, error } = usePreferences();
  const selected = Object.hasOwn(appearanceChoices, choice ?? '')
    ? (choice as AppearanceChoice)
    : undefined;
  const rows = (keys: readonly AppearanceChoice[]) =>
    keys.map((key) => (
      <SettingsNavigationRow
        key={key}
        label={appearanceChoices[key].label}
        value={choiceLabel(key, preferences[key])}
        onPress={() => onOpenChoice(key)}
      />
    ));
  return (
    <View style={styles.page}>
      {selected ? (
        <ChoicePicker choice={selected} />
      ) : (
        <>
          <SettingsSection title="Display" padded={false}>
            {rows(displayChoices)}
          </SettingsSection>
          <SettingsSection
            title="Board"
            padded={false}
            footer="Saved on this device. These choices apply to every account here."
          >
            {rows(boardChoices)}
          </SettingsSection>
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  page: { gap: theme.spacing.lg },
  error: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.dangerText,
  },
}));
