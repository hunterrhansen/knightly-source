import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PreferencesProvider } from '../../theme/preferences';
import { AppearanceSettings } from './appearance-settings';

// Native presentation is inspected on-device; exercise the shared preference flow.
jest.mock('./appearance-settings', () =>
  jest.requireActual('./appearance-settings.tsx'),
);
function Preview() {
  return (
    <PreferencesProvider>
      <AppearanceSettings choice="board" onOpenChoice={() => {}} />
    </PreferencesProvider>
  );
}
test('a board colour picked through Expo UI is restored when appearance settings reopen', async () => {
  const first = render(<Preview />);
  const picker = await first.findByRole('combobox', { name: 'Board colors' });
  fireEvent(picker, 'valueChange', 'calm');
  await waitFor(() =>
    expect(
      first.getByRole('combobox', { name: 'Board colors' }).props
        .accessibilityValue.text,
    ).toBe('calm'),
  );
  first.unmount();
  const restored = render(<Preview />);
  await waitFor(() =>
    expect(
      restored.getByRole('combobox', { name: 'Board colors' }).props
        .accessibilityValue.text,
    ).toBe('calm'),
  );
});
