import { Button, Circle, Host, Text, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  buttonStyle,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  offset,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '../../theme/theme';
/** Decorative SwiftUI counterpart of Avatar (brand disc on its ledge), for native forms and toolbar content. */
export function NativeAvatar({ name }: { name: string }) {
  const { theme } = useTheme();
  return (
    <ZStack
      modifiers={[
        frame({ width: 36, height: 36 }),
        clipShape('circle'),
        accessibilityHidden(true),
      ]}
    >
      <Circle modifiers={[foregroundStyle(theme.colors.brandLedge)]} />
      <Circle
        modifiers={[foregroundStyle(theme.colors.brand), offset({ y: -3 })]}
      />
      <Text
        modifiers={[
          font({ family: 'Fredoka-SemiBold', size: 20 }),
          foregroundStyle(theme.colors.onBrand),
        ]}
      >
        {name.trim().slice(0, 1).toUpperCase() || '?'}
      </Text>
    </ZStack>
  );
}
/** Host owns toolbar sizing; SwiftUI owns the accessible button and press feedback. */
export function NativeAvatarButton({
  name,
  label,
  onPress,
}: {
  name: string;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Host matchContents colorScheme="dark" seedColor={theme.colors.brandText}>
      <Button
        onPress={onPress}
        modifiers={[buttonStyle('plain'), accessibilityLabel(label)]}
      >
        <ZStack
          modifiers={[
            frame({ width: 44, height: 44 }),
            contentShape(shapes.rectangle()),
          ]}
        >
          <NativeAvatar name={name} />
        </ZStack>
      </Button>
    </Host>
  );
}
