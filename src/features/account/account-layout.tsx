import { Text, View } from 'react-native';
import { usePreferences } from '../../theme/preferences';
import { createStyles } from '../../theme/theme';
import {
  Avatar,
  Card,
  SettingsActionRow,
  SettingsNavigationRow,
  SettingsSection,
} from '../../ui';
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
  const styles = useStyles();
  const { preferences } = usePreferences();
  const privacy = (
    <SettingsNavigationRow
      leading={<SettingsIcon name="privacy" />}
      label="Privacy and licences"
      description="Your information, and the open-source engine Knightly runs."
      onPress={onOpenPrivacy}
    />
  );
  return (
    <SettingsPageFrame title="Account" onBack={onBack}>
      {preview && (
        <Text style={styles.quiet}>Design preview · sample account</Text>
      )}
      <Card>
        <View style={styles.profile}>
          <Avatar name={accountName} />
          <View style={styles.identity}>
            <Text accessibilityRole="header" style={styles.name}>
              {accountName}
            </Text>
            <Text style={styles.quiet}>
              {preview ? 'Demo Knightly account' : 'Your Knightly account'}
            </Text>
          </View>
        </View>
      </Card>
      <SettingsSection title="Settings" padded={false}>
        {(
          [
            [
              'appearance',
              'Appearance',
              `${preferences.board.charAt(0).toUpperCase()}${preferences.board.slice(1)} board`,
            ],
            ['connections', 'Linked accounts', 'Chess.com and Lichess'],
            // Reminders are local notifications (iOS and Android); the watch
            // itself is chosen everywhere.
            ['reminders', 'Your watch', 'Time, habit and reminder'],
            ['updates', 'Daily update', 'Sync and analysis status'],
            ['analysis', 'Analysis', 'Depth and practice scheduling'],
            ['data', 'Your data', 'Usage, export and account deletion'],
          ] as const
        ).map(([section, label, description]) => (
          <SettingsNavigationRow
            key={section}
            leading={<SettingsIcon name={section} />}
            label={label}
            description={description}
            onPress={() => onOpenSettings(section)}
          />
        ))}
        {privacy}
      </SettingsSection>
      <SettingsSection
        title="Your session"
        padded={false}
        description={
          preview
            ? 'Sign-in and sign-out controls appear for your real account.'
            : 'Sign out of Knightly on this device.'
        }
      >
        {onSignOut && (
          <SettingsActionRow
            destructive
            leading={<SettingsIcon name="sign-out" />}
            label="Sign out"
            description="End your session on this device."
            onPress={onSignOut}
          />
        )}
      </SettingsSection>
    </SettingsPageFrame>
  );
}
const useStyles = createStyles((theme) => ({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  identity: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  name: {
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.ink,
  },
  quiet: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.inkMuted,
  },
}));
