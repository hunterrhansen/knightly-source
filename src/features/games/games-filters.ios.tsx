import {
  BottomSheet,
  Button,
  Group,
  Host,
  HStack,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  disabled,
  font,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { useRef, useState } from 'react';
import { useTheme } from '../../theme/theme';
import {
  NativeSettingsActionRow,
  NativeSettingsFormContent,
  NativeSettingsPickerRow,
  NativeSettingsSection,
} from '../../ui/native-settings';
import type { GamesFiltersProps } from './games-filters-types';
import {
  filterChoices,
  filterKeys,
  type GamesFilterDraft,
} from './games-presentation';

export function GamesFilters({ value, onApply, onCancel }: GamesFiltersProps) {
  const [draft, setDraft] = useState(value);
  const [presented, setPresented] = useState(true);
  const pendingApply = useRef<GamesFilterDraft | null>(null);
  const { theme } = useTheme();
  return (
    <Host
      style={{ position: 'absolute', width: 1, height: 1 }}
      colorScheme="dark"
      seedColor={theme.colors.brandText}
    >
      <BottomSheet
        isPresented={presented}
        onIsPresentedChange={setPresented}
        onDismiss={() => {
          // Keep the native presentation host alive until UIKit has actually dismissed it.
          const applied = pendingApply.current;
          pendingApply.current = null;
          if (applied) onApply(applied);
          else onCancel();
        }}
      >
        <Group
          modifiers={[
            presentationDetents(['large']),
            presentationDragIndicator('visible'),
          ]}
        >
          <NativeSettingsFormContent>
            <NativeSettingsSection>
              <HStack>
                <Text
                  modifiers={[
                    accessibilityAddTraits(['isHeader']),
                    font({
                      family: 'Fredoka-SemiBold',
                      size: 20,
                      textStyle: 'headline',
                    }),
                  ]}
                >
                  Filters
                </Text>
                <Spacer />
                <Button
                  label="Cancel"
                  onPress={() => setPresented(false)}
                  modifiers={[disabled(!presented)]}
                />
              </HStack>
            </NativeSettingsSection>
            <NativeSettingsSection>
              {filterKeys.map((key) => (
                <NativeSettingsPickerRow
                  key={key}
                  label={filterChoices[key].title}
                  value={draft[key] ?? ''}
                  options={[...filterChoices[key].options]}
                  disabled={!presented}
                  onChange={(choice) =>
                    setDraft((previous) => ({
                      ...previous,
                      [key]: choice || undefined,
                    }))
                  }
                />
              ))}
            </NativeSettingsSection>
            <NativeSettingsSection>
              <NativeSettingsActionRow
                label="Apply filters"
                disabled={!presented}
                onPress={() => {
                  pendingApply.current = draft;
                  setPresented(false);
                }}
              />
              <NativeSettingsActionRow
                label="Reset filters"
                disabled={!presented}
                onPress={() => setDraft({})}
              />
            </NativeSettingsSection>
          </NativeSettingsFormContent>
        </Group>
      </BottomSheet>
    </Host>
  );
}
