import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { PreferencesProvider } from '../../theme/preferences';
import { AccountLayout } from './account-layout';

const mockWidth = { current: 1024 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    width: mockWidth.current,
    height: 800,
    scale: 1,
    fontScale: 1,
  }),
}));
// The frame's header needs a navigator; these tests cover the page's rows.
jest.mock('./settings-page-frame', () => ({
  SettingsPageFrame: ({ children }: { children: React.ReactNode }) => children,
}));
// Exercise the shared (web and Android) layout, not the iOS variant.
jest.mock('./account-layout', () => jest.requireActual('./account-layout.tsx'));

function renderAccount(width: number) {
  mockWidth.current = width;
  jest.replaceProperty(Platform, 'OS', 'web');
  return render(
    <PreferencesProvider>
      <AccountLayout
        accountName="Alex"
        onBack={() => {}}
        onOpenPrivacy={() => {}}
        onOpenSettings={() => {}}
        onSignOut={() => {}}
      />
    </PreferencesProvider>,
  );
}

test('web Account lists its settings at every width, since there is no sidebar gear', async () => {
  for (const width of [1024, 390]) {
    const screen = renderAccount(width);
    expect(await screen.findByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Linked accounts')).toBeTruthy();
    expect(screen.getByText('Privacy and licences')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
    screen.unmount();
  }
});
