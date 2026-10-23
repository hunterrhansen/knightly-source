import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { ReminderSettings } from '../today/today-api';
import { AccountSettingsPanels } from './account-settings';
import { AccountSettingsPreview } from './account-settings-preview';
import type { AppearanceChoice } from './appearance-choices';
import { AppearanceSettings } from './appearance-settings';
import { SettingsPageFrame } from './settings-page-frame';
import { settingsSectionTitles as titles } from './settings-sections';

export function AccountSettingsPage({
  section,
  choice,
  onOpenChoice,
  preview = false,
  onBack,
}: {
  section: string;
  choice?: string;
  onOpenChoice: (choice: AppearanceChoice) => void;
  preview?: boolean;
  onBack: () => void;
}) {
  const detailChoice = Platform.OS === 'ios' ? undefined : choice;
  const selected = Object.hasOwn(titles, section) ? section : 'appearance';
  return (
    <SettingsPageFrame
      title={
        selected === 'appearance' && detailChoice === 'board'
          ? 'Board colors'
          : (titles[selected] ?? 'Appearance')
      }
      onBack={onBack}
      nativeForm
    >
      {selected === 'appearance' ? (
        <AppearanceSettings choice={detailChoice} onOpenChoice={onOpenChoice} />
      ) : selected === 'reminders' ? (
        <ReminderSettings preview={preview} />
      ) : preview ? (
        <AccountSettingsPreview section={selected} />
      ) : (
        <AccountSettingsPanels section={selected} />
      )}
    </SettingsPageFrame>
  );
}
export function AccountSettingsScreen() {
  const { section, choice } = useLocalSearchParams<{
    section?: string;
    choice?: string;
  }>();
  const router = useRouter();
  return (
    <AccountSettingsPage
      section={section ?? 'appearance'}
      choice={choice}
      onOpenChoice={(choice) =>
        router.push({
          pathname: '/account-settings',
          params: { section: 'appearance', choice },
        })
      }
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace('/account')
      }
    />
  );
}
