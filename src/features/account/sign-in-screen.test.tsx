import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { useFoundation } from '../../lib/auth/auth-provider';
import { SignInScreen } from './sign-in-screen';

let mockState: ReturnType<typeof useFoundation>;
jest.mock('../../lib/auth/auth-provider', () => ({
  useFoundation: () => mockState,
}));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./sign-in-action', () => {
  const { Text } = jest.requireActual('react-native');
  return { SignInAction: () => <Text>Sign in</Text> };
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ui = () => (
  <SafeAreaProvider initialMetrics={metrics}>
    <SignInScreen />
  </SafeAreaProvider>
);
test('a session that is still connecting shows the launch screen instead of sign-in', () => {
  mockState = { phase: 'loading', retry: () => {} };
  const view = render(ui());
  expect(screen.getByLabelText('Loading Knightly')).toBeOnTheScreen();
  expect(screen.queryByText('Turn your games into practice')).toBeNull();
  expect(screen.queryByText('Sign in')).toBeNull();

  mockState = { phase: 'signed-out', retry: () => {} };
  view.rerender(ui());
  expect(screen.queryByLabelText('Loading Knightly')).toBeNull();
  expect(screen.getByText('Turn your games into practice')).toBeOnTheScreen();
  expect(screen.getByText('Sign in')).toBeOnTheScreen();
});
