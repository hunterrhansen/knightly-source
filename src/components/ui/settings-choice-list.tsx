import { type ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { SettingsSection } from './settings-section';

export function SettingsChoiceList<T extends string>({
  title,
  value,
  options,
  onChange,
  disabled = false,
  footer,
  hideHeading = false,
}: {
  title: string;
  value: T;
  options: readonly { value: T; label: string; leading?: ReactNode }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  footer?: string;
  hideHeading?: boolean;
}) {
  const styles = useStyles();
  const [focused, setFocused] = useState<T>();
  const { theme } = useTheme();
  return (
    <SettingsSection
      title={hideHeading ? undefined : title}
      padded={false}
      footer={footer}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={`${title}: ${option.label}`}
          accessibilityState={{ checked: value === option.value, disabled }}
          aria-checked={value === option.value}
          disabled={disabled}
          onFocus={() => setFocused(option.value)}
          onBlur={() => setFocused(undefined)}
          onPress={() => {
            if (value !== option.value) onChange(option.value);
          }}
          style={({ pressed }) => [
            styles.row,
            focused === option.value && styles.focused,
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          {option.leading != null && (
            <View
              accessible={false}
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {option.leading}
            </View>
          )}
          <Text style={styles.label}>{option.label}</Text>
          <View
            accessible={false}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.check}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              {value === option.value && (
                <Path
                  d="m5 12 4 4 10-10"
                  fill="none"
                  stroke={theme.colors.brandText}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
          </View>
        </Pressable>
      ))}
    </SettingsSection>
  );
}
const useStyles = createStyles((theme) => ({
  row: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  focused: { borderColor: theme.colors.focus },
  label: {
    flex: 1,
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.ink,
  },
  check: { width: 24, alignItems: 'center' },
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  disabled: { opacity: 0.5 },
}));
