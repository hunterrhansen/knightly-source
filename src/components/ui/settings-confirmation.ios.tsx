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
  interactiveDismissDisabled,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '../../theme/theme';
import {
  NativeSettingsFormContent,
  NativeSettingsSection,
} from './native-settings';
import type { SettingsConfirmationProps } from './settings-confirmation-types';
/** SwiftUI owns sheet presentation, keyboard avoidance and interactive dismissal. */
export function SettingsConfirmation({
  title,
  onCancel,
  busy = false,
  children,
}: SettingsConfirmationProps) {
  const { theme } = useTheme();
  return (
    <Host
      style={{ position: 'absolute', width: 1, height: 1 }}
      colorScheme="dark"
      seedColor={theme.colors.brandText}
    >
      <BottomSheet
        isPresented
        onIsPresentedChange={(presented) => {
          if (!presented && !busy) onCancel();
        }}
      >
        <Group
          modifiers={[
            presentationDetents(['large']),
            presentationDragIndicator('visible'),
            interactiveDismissDisabled(busy),
          ]}
        >
          <NativeSettingsFormContent>
            <NativeSettingsSection>
              <HStack>
                <Text
                  modifiers={[
                    accessibilityAddTraits(['isHeader']),
                    font({ size: 17, weight: 'semibold' }),
                  ]}
                >
                  {title}
                </Text>
                <Spacer />
                <Button
                  label="Cancel"
                  onPress={onCancel}
                  modifiers={[font({ size: 17 }), disabled(busy)]}
                />
              </HStack>
            </NativeSettingsSection>
            {children}
          </NativeSettingsFormContent>
        </Group>
      </BottomSheet>
    </Host>
  );
}
