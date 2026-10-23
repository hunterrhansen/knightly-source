import type { ReactNode } from 'react';
import { useTheme } from '../../theme/theme';
import { ListItem } from './list-item';

/** Text action with the same full-row press/focus behavior as settings navigation. */
export function SettingsActionRow({
  label,
  leading,
  description,
  onPress,
  disabled = false,
  destructive = false,
  topSeparator = false,
  accessibilityLabel,
}: {
  label: string;
  leading?: ReactNode;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  topSeparator?: boolean;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  return (
    <ListItem
      label={label}
      leading={leading}
      description={description}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      topSeparator={topSeparator}
      groupPosition="middle"
      labelStyle={{
        color: destructive ? theme.colors.dangerText : theme.colors.brandText,
      }}
    />
  );
}
