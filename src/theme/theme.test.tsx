import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';
import { PreferencesProvider, usePreferences } from './preferences';
import { ThemeRoot, useTheme } from './theme';
import { darkTheme } from './themes';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

let choose: ReturnType<typeof usePreferences>['set'] = () => {};
function Probe() {
  const { theme } = useTheme();
  choose = usePreferences().set;
  return (
    <Text testID="probe">{`${theme.colors.page} ${theme.colors.boardLight}`}</Text>
  );
}

test('the app stays dark on a light device, and a chosen board persists across relaunch', async () => {
  expect(useColorScheme()).toBe('light');
  const app = () => (
    <ThemeRoot>
      <PreferencesProvider>
        <Probe />
      </PreferencesProvider>
    </ThemeRoot>
  );
  const first = render(app());
  expect(await screen.findByTestId('probe')).toHaveTextContent(
    `${darkTheme.colors.page} ${darkTheme.colors.boardLight}`,
  );

  act(() => choose({ board: 'calm' }));
  // Calm's squares, not the theme's default board.
  expect(screen.getByTestId('probe')).toHaveTextContent(
    `${darkTheme.colors.page} #6F777E`,
  );

  // Let the save finish, then relaunch.
  await act(async () => {});
  first.unmount();
  render(app());
  await waitFor(() =>
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `${darkTheme.colors.page} #6F777E`,
    ),
  );
});
