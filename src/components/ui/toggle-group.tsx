import { type ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { tapHaptic } from '../../lib/haptics';
import { createStyles } from '../../theme/theme';
import { usePressSquish } from './press-squish';

/** One choice from a few. `segmented` (default) is a track for settings and
 * filters; `pills` are separate chips for a page's period (Progress). */
export function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  fullWidth = false,
  variant = 'segmented',
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; leading?: ReactNode }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: 'segmented' | 'pills';
}) {
  const styles = useStyles();
  const pills = variant === 'pills';
  const [focus, setFocus] = useState<T>();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[
        pills ? styles.pills : styles.track,
        fullWidth && styles.fullWidth,
      ]}
    >
      {options.map((option) => (
        <ToggleOption
          key={option.value}
          groupLabel={label}
          label={option.label}
          leading={option.leading}
          checked={option.value === value}
          focused={focus === option.value}
          disabled={disabled}
          fullWidth={fullWidth}
          pills={pills}
          onPress={() => {
            if (option.value === value) return;
            // A segmented control ticks as its value changes.
            tapHaptic();
            onChange(option.value);
          }}
          onFocus={() => setFocus(option.value)}
          onBlur={() => setFocus(undefined)}
        />
      ))}
    </View>
  );
}

function ToggleOption({
  groupLabel,
  label,
  leading,
  checked,
  focused,
  disabled,
  fullWidth,
  pills,
  onPress,
  onFocus,
  onBlur,
}: {
  groupLabel: string;
  label: string;
  leading?: ReactNode;
  checked: boolean;
  focused: boolean;
  disabled: boolean;
  fullWidth: boolean;
  pills: boolean;
  onPress: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const styles = useStyles();
  const squish = usePressSquish();
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      accessibilityLabel={`${groupLabel}: ${label}`}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={squish.onPressIn}
      onPressOut={squish.onPressOut}
      onFocus={onFocus}
      onBlur={onBlur}
      style={fullWidth && styles.equalTarget}
    >
      <Animated.View
        style={[
          pills ? styles.pill : styles.option,
          styles.face,
          fullWidth && styles.equalOption,
          checked && (pills ? styles.pillSelected : styles.selected),
          focused && styles.focused,
          disabled && styles.disabled,
          squish.style,
        ]}
      >
        {leading && (
          <View
            accessible={false}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {leading}
          </View>
        )}
        <Text style={[styles.label, pills && styles.pillLabel(checked)]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
const useStyles = createStyles((theme) => ({
  track: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  // Layout sits on the press target; the face fills it and squashes.
  equalTarget: { flex: 1, minWidth: 0 },
  equalOption: { minWidth: 0, paddingHorizontal: 4 },
  face: { flexGrow: 1 },
  selected: { backgroundColor: theme.colors.surface },
  pills: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pill: {
    minWidth: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.line,
  },
  pillSelected: {
    backgroundColor: theme.colors.brandTint,
    borderColor: theme.colors.brand,
  },
  pillLabel: (selected: boolean) => ({
    color: selected ? theme.colors.brandText : theme.colors.inkMuted,
  }),
  focused: { borderColor: theme.colors.focus },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: theme.typography.bold,
    fontSize: 14,
    color: theme.colors.ink,
  },
}));
