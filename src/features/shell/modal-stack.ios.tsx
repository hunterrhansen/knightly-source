import { Stack } from 'expo-router';
import { useNavigationHeaderOptions } from '../../ui';
import { type ModalStackProps, useCloseModal } from './modal-stack-types';

/** A modal's own stack over the path (Games, Progress), as Account's: the
 * system's full-height sheet with the native ✕ at the top right of its root
 * and swipe down to close. Pushes inside it stay in the sheet. */
export function ModalStack({ label, bare = [] }: ModalStackProps) {
  const options = useNavigationHeaderOptions();
  const close = useCloseModal();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ headerBackVisible: false }}>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="xmark"
            accessibilityLabel={`Close ${label}`}
            onPress={close}
          />
        </Stack.Toolbar>
      </Stack.Screen>
      {bare.map((name) => (
        <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
      ))}
    </Stack>
  );
}
