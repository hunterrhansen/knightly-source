import type {
  TextInputProps as ExpoTextInputProps,
  TextInputRef,
} from '@expo/ui';
import { forwardRef, useId, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet as RNStyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { createStyles, useTheme } from '../theme/theme';
import { tokens } from '../theme/tokens';
import { ControlHost } from './control-host';
import { ControlledTextInput } from './controlled-text-input';

type TextFieldProps = Omit<ExpoTextInputProps, 'value' | 'style' | 'ref'> & {
  label: string;
  hideLabel?: boolean;
  variant?: 'form' | 'search';
  containerStyle?: StyleProp<ViewStyle>;
  value: string;
  helpText?: string;
  error?: string;
  style?: StyleProp<Pick<TextStyle, 'fontSize'>>;
  /** Compatibility for existing RN callers; Expo maps autocomplete to native autofill. */
  textContentType?: 'username' | 'password' | 'oneTimeCode';
};

/** Universal Expo UI field with Knightly labels, focus and validation. */
export const TextField = forwardRef<TextInputRef, TextFieldProps>(
  function TextField(
    {
      label,
      hideLabel = false,
      variant = 'form',
      containerStyle,
      helpText,
      error,
      accessibilityLabel = label,
      accessibilityHint,
      editable = true,
      style,
      textStyle,
      textContentType,
      autoComplete,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) {
    const styles = useStyles();
    const [focused, setFocused] = useState(false);
    const [clearFocused, setClearFocused] = useState(false);
    const inputRef = useRef<TextInputRef | null>(null);
    const messageId = useId();
    const { theme } = useTheme();
    const { fontScale } = useWindowDimensions();
    const overrides = RNStyleSheet.flatten(style);
    // SwiftUI custom fonts and Compose sp already respect system scaling.
    const fontSize =
      overrides?.fontSize ?? textStyle?.fontSize ?? theme.typography.size.body;
    const scaledSize = fontSize * Math.max(1, fontScale);
    const showSearchIcon = Platform.OS === 'web' && variant === 'search';
    const showClear =
      showSearchIcon && props.value.length > 0 && editable && !props.readOnly;
    const borderColor = error
      ? theme.colors.dangerText
      : focused
        ? theme.colors.inkMuted
        : variant === 'search'
          ? 'transparent'
          : theme.colors.line;
    const hint = [accessibilityHint, error || helpText]
      .filter(Boolean)
      .join('. ');
    const autofill =
      autoComplete ??
      (textContentType === 'oneTimeCode'
        ? 'one-time-code'
        : textContentType === 'password'
          ? 'current-password'
          : textContentType === 'username'
            ? 'username'
            : undefined);
    return (
      <View style={[styles.field, containerStyle]}>
        {!hideLabel && <Text style={styles.label}>{label}</Text>}
        <View style={styles.inputContainer}>
          <ControlHost
            matchContents={{ vertical: true }}
            style={{ width: '100%' }}
          >
            <ControlledTextInput
              {...props}
              ref={(input) => {
                inputRef.current = input;
                if (typeof ref === 'function') ref(input);
                else if (ref) ref.current = input;
              }}
              editable={editable}
              accessibilityLabel={accessibilityLabel}
              accessibilityHint={hint || undefined}
              aria-describedby={error || helpText ? messageId : undefined}
              aria-invalid={!!error}
              autoComplete={autofill}
              onFocus={() => {
                setFocused(true);
                onFocus?.();
              }}
              onBlur={() => {
                setFocused(false);
                onBlur?.();
              }}
              placeholderTextColor={
                props.placeholderTextColor ?? theme.colors.inkMuted
              }
              style={{
                width: '100%',
                height: props.multiline
                  ? undefined
                  : Math.max(
                      theme.layout.minControl,
                      scaledSize * 1.4 +
                        (theme.spacing.sm + theme.spacing.xs) * 2,
                    ),
                paddingHorizontal:
                  variant === 'search'
                    ? theme.spacing.md
                    : theme.spacing.sm + theme.spacing.xs,
                paddingLeft: showSearchIcon
                  ? theme.spacing.md + 18 + theme.spacing.sm
                  : undefined,
                paddingRight: showClear ? 48 : undefined,
                paddingVertical:
                  variant === 'search'
                    ? theme.spacing.sm
                    : theme.spacing.sm + theme.spacing.xs,
                borderWidth: Platform.OS === 'ios' ? undefined : 1,
                borderColor: Platform.OS === 'ios' ? undefined : borderColor,
                borderRadius: tokens.radius.control,
                backgroundColor:
                  variant === 'search'
                    ? theme.colors.surfaceMuted
                    : theme.colors.page,
                opacity: editable && !props.readOnly ? 1 : 0.5,
                // Our shared ring replaces Expo UI's web focus shadow.
                ...(Platform.OS === 'web' ? { boxShadow: 'none' } : {}),
              }}
              textStyle={{
                fontFamily:
                  Platform.OS === 'ios'
                    ? 'Nunito-SemiBold'
                    : theme.typography.body,
                color: theme.colors.ink,
                ...textStyle,
                fontSize,
              }}
            />
          </ControlHost>
          {focused && editable && !props.readOnly && (
            <View
              pointerEvents="none"
              accessible={false}
              aria-hidden
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                bottom: -3,
                left: -3,
                borderWidth: 3,
                borderColor,
                borderRadius: tokens.radius.control + 3,
                opacity: error ? 0.4 : 0.5,
              }}
            />
          )}
          {/* Expo's iOS border is rectangular before clipping; draw a rounded
              stroke above the native field without changing its input bounds. */}
          {Platform.OS === 'ios' && (
            <View
              pointerEvents="none"
              accessible={false}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderWidth: 1,
                borderColor,
                borderRadius: tokens.radius.control,
                opacity: editable && !props.readOnly ? 1 : 0.5,
              }}
            />
          )}
          {showSearchIcon && (
            <View
              pointerEvents="none"
              accessible={false}
              aria-hidden
              style={styles.searchIcon}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
                <Circle
                  cx={10.5}
                  cy={10.5}
                  r={6.5}
                  fill="none"
                  stroke={theme.colors.inkMuted}
                  strokeWidth={2}
                />
                <Path
                  d="m16 16 5 5"
                  fill="none"
                  stroke={theme.colors.inkMuted}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
          )}
          {showClear && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onFocus={() => setClearFocused(true)}
              onBlur={() => setClearFocused(false)}
              onPress={() => {
                setClearFocused(false);
                props.onChangeText?.('');
                inputRef.current?.focus();
              }}
              style={[styles.clearSearch, clearFocused && styles.clearFocused]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
                <Circle cx={12} cy={12} r={9} fill={theme.colors.inkMuted} />
                <Path
                  d="m9 9 6 6m0-6-6 6"
                  fill="none"
                  stroke={theme.colors.surfaceMuted}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          )}
        </View>
        {error ? (
          <Text
            nativeID={messageId}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.error}
          >
            {error}
          </Text>
        ) : helpText ? (
          <Text nativeID={messageId} style={styles.help}>
            {helpText}
          </Text>
        ) : null}
      </View>
    );
  },
);
const useStyles = createStyles((theme) => ({
  field: { minWidth: 0, gap: theme.spacing.sm },
  inputContainer: { width: '100%', minWidth: 0 },
  clearSearch: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: tokens.radius.control,
  },
  clearFocused: { borderColor: theme.colors.focus },
  searchIcon: {
    position: 'absolute',
    left: theme.spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  label: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  help: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
  },
  error: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.dangerText,
  },
}));
