import { Image } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  background,
  cornerRadius,
  frame,
} from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '../../theme/theme';

const symbols = {
  appearance: 'sun.max',
  connections: 'link',
  reminders: 'bell',
  updates: 'arrow.triangle.2.circlepath',
  analysis: 'chart.bar',
  data: 'doc.text',
  privacy: 'lock.shield',
  'sign-out': 'rectangle.portrait.and.arrow.right',
} as const;
export function SettingsIcon({ name }: { name: keyof typeof symbols }) {
  const { theme } = useTheme();
  const gold = name === 'appearance' || name === 'analysis';
  const blue = name === 'connections' || name === 'data';
  const danger = name === 'sign-out';
  const color = gold
    ? theme.boardAnnotations.hintGold
    : blue
      ? theme.boardAnnotations.analysis
      : danger
        ? theme.boardAnnotations.danger
        : theme.colors.brand;
  return (
    <Image
      systemName={symbols[name]}
      size={17}
      color={
        gold
          ? theme.boardAnnotations.onHintGold
          : blue || danger
            ? '#ffffff'
            : theme.colors.onBrand
      }
      modifiers={[
        frame({ width: 28, height: 28 }),
        background(color),
        cornerRadius(7),
        accessibilityHidden(true),
      ]}
    />
  );
}
