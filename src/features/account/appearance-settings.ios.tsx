import { HStack, Rectangle, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  foregroundStyle,
  frame,
} from '@expo/ui/swift-ui/modifiers';
import {
  boardSquareColors,
  type Preferences,
  usePreferences,
} from '../../theme/preferences';
import {
  NativeSettingsForm,
  NativeSettingsPickerRow,
  NativeSettingsSection,
} from '../../ui/native-settings';
import {
  type AppearanceChoice,
  appearanceChoices,
  boardChoices,
  displayChoices,
} from './appearance-choices';

function BoardSwatch({ board }: { board: Preferences['board'] }) {
  const colors = boardSquareColors(board);
  return (
    <VStack spacing={0} modifiers={[accessibilityHidden(true)]}>
      <HStack spacing={0}>
        <Rectangle
          modifiers={[
            frame({ width: 10, height: 10 }),
            foregroundStyle(colors[0]),
          ]}
        />
        <Rectangle
          modifiers={[
            frame({ width: 10, height: 10 }),
            foregroundStyle(colors[1]),
          ]}
        />
      </HStack>
      <HStack spacing={0}>
        <Rectangle
          modifiers={[
            frame({ width: 10, height: 10 }),
            foregroundStyle(colors[1]),
          ]}
        />
        <Rectangle
          modifiers={[
            frame({ width: 10, height: 10 }),
            foregroundStyle(colors[0]),
          ]}
        />
      </HStack>
    </VStack>
  );
}
function ChoicePicker<K extends AppearanceChoice>({ choice }: { choice: K }) {
  const { preferences, ready, set } = usePreferences();
  return (
    // A native SwiftUI picker row, like the rest of Settings: the grouped cell
    // draws the background, so there is no inner box.
    <NativeSettingsPickerRow
      label={appearanceChoices[choice].label}
      value={preferences[choice]}
      leading={
        choice === 'board' ? (
          <BoardSwatch board={preferences.board} />
        ) : undefined
      }
      disabled={!ready}
      onChange={(next) => set({ [choice]: next })}
      options={appearanceChoices[choice].options.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
    />
  );
}
export function AppearanceSettings(_props: {
  choice?: string;
  onOpenChoice: (choice: AppearanceChoice) => void;
}) {
  const { error } = usePreferences();
  return (
    <NativeSettingsForm>
      <NativeSettingsSection title="Display">
        {displayChoices.map((choice) => (
          <ChoicePicker key={choice} choice={choice} />
        ))}
      </NativeSettingsSection>
      <NativeSettingsSection
        title="Board"
        footer="Saved on this device; these choices apply to every account here."
      >
        {boardChoices.map((choice) => (
          <ChoicePicker key={choice} choice={choice} />
        ))}
      </NativeSettingsSection>
      {error && (
        <NativeSettingsSection
          title="Could not save appearance"
          footer={error}
        />
      )}
    </NativeSettingsForm>
  );
}
