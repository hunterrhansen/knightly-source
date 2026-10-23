import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  listRowBackground,
} from '@expo/ui/swift-ui/modifiers';
import { usePreferences } from '../../theme/preferences';
import { useTheme } from '../../theme/theme';
import {
  NativeAvatar,
  NativeSettingsActionRow,
  NativeSettingsForm,
  NativeSettingsNavigationRow,
  NativeSettingsSection,
} from '../../ui/native-settings';
import type { AccountLayoutProps } from './account-layout-types';
import { SettingsIcon } from './settings-icon';
import { SettingsPageFrame } from './settings-page-frame';
export function AccountLayout({
  accountName,
  onOpenSettings,
  onBack,
  onOpenPrivacy,
  onSignOut,
  preview = false,
}: AccountLayoutProps) {
  const { preferences } = usePreferences();
  const { theme } = useTheme();
  return (
    <SettingsPageFrame title="Account" onBack={onBack} nativeForm modalRoot>
      <NativeSettingsForm>
        <NativeSettingsSection
          footer={preview ? 'Design preview · sample account' : undefined}
        >
          <HStack
            spacing={12}
            modifiers={[listRowBackground(theme.colors.surface)]}
          >
            <NativeAvatar name={accountName} />
            <VStack alignment="leading" spacing={4}>
              <Text modifiers={[foregroundStyle(theme.colors.ink)]}>
                {accountName}
              </Text>
              <Text
                modifiers={[
                  font({
                    family: 'Nunito-SemiBold',
                    size: 14,
                    textStyle: 'footnote',
                  }),
                  foregroundStyle(theme.colors.inkMuted),
                ]}
              >
                {preview ? 'Demo Knightly account' : 'Your Knightly account'}
              </Text>
            </VStack>
          </HStack>
        </NativeSettingsSection>
        <NativeSettingsSection title="Settings">
          {(
            [
              [
                'appearance',
                'Appearance',
                `${preferences.board.charAt(0).toUpperCase()}${preferences.board.slice(1)} board`,
              ],
              ['connections', 'Linked accounts', 'Chess.com and Lichess'],
              ['reminders', 'Your watch', 'Time, habit and reminder'],
              ['updates', 'Daily update', 'Sync and analysis status'],
              ['analysis', 'Analysis', 'Depth and practice scheduling'],
              ['data', 'Your data', 'Usage, export and account deletion'],
            ] as const
          ).map(([section, label, description]) => (
            <NativeSettingsNavigationRow
              key={section}
              label={label}
              description={description}
              leading={<SettingsIcon name={section} />}
              onPress={() => onOpenSettings(section)}
            />
          ))}
          <NativeSettingsNavigationRow
            label="Privacy and licences"
            description="Your information, and the open-source engine Knightly runs."
            leading={<SettingsIcon name="privacy" />}
            onPress={onOpenPrivacy}
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title="Your session"
          footer={
            preview
              ? 'Sign-in and sign-out controls appear for your real account.'
              : 'Sign out of Knightly on this device.'
          }
        >
          {onSignOut && (
            <NativeSettingsActionRow
              label="Sign out"
              destructive
              leading={<SettingsIcon name="sign-out" />}
              onPress={onSignOut}
            />
          )}
        </NativeSettingsSection>
      </NativeSettingsForm>
    </SettingsPageFrame>
  );
}
