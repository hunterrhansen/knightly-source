import { Stack } from 'expo-router';
import { IconButton, useNavigationHeaderOptions } from '../../ui';
import { type ModalStackProps, useCloseModal } from './modal-stack-types';

/** A modal's own stack over the path (Games, Progress), presented as
 * Account is on Android: a pushed page, its root with a close button at the
 * top right. Pushes inside it stay in its stack. */
export function ModalStack({ label, bare = [] }: ModalStackProps) {
  const options = useNavigationHeaderOptions();
  const close = useCloseModal();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen
        name="index"
        options={{
          headerBackVisible: false,
          headerRight: () => (
            <IconButton
              icon="close"
              accessibilityLabel={`Close ${label}`}
              onPress={close}
              compact
            />
          ),
        }}
      />
      {bare.map((name) => (
        <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
      ))}
    </Stack>
  );
}
