import { Stack } from 'expo-router';
import { NativeAvatarButton } from '../../ui/native-settings';
/** Preview the production native avatar control without an authenticated account. */
export function PreviewAccountToolbar({
  onOpenAccount,
}: {
  onOpenAccount: () => void;
}) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.View hidesSharedBackground>
        <NativeAvatarButton
          name="Alex Morgan"
          label="Account & settings"
          onPress={onOpenAccount}
        />
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
