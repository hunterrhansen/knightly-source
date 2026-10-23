import type { TextInputRef } from '@expo/ui';
import {
  Button,
  Form,
  Host,
  HStack,
  Image,
  Label,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  background,
  disabled,
  font,
  foregroundStyle,
  keyboardType,
  listRowBackground,
  pickerStyle,
  scrollContentBackground,
  scrollDismissesKeyboard,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { type PropsWithChildren, type ReactNode, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { ControlledTextInput } from '../../ui/controlled-text-input';

/** A full-page SwiftUI Form: it owns scrolling and native grouped-list geometry. */
export function NativeSettingsForm({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  return (
    <Host
      style={{ flex: 1 }}
      colorScheme="dark"
      seedColor={theme.colors.brandText}
    >
      <NativeSettingsFormContent>{children}</NativeSettingsFormContent>
    </Host>
  );
}
/** Form content for both screen hosts and native sheets; never nests a Host. */
export function NativeSettingsFormContent({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  return (
    <Form
      modifiers={[
        scrollContentBackground('hidden'),
        scrollDismissesKeyboard('interactively'),
        background(theme.colors.page),
        font({
          // SwiftUI resolves the embedded PostScript name, not Expo Font’s alias.
          family: 'Nunito-SemiBold',
          size: 17,
          textStyle: 'body',
        }),
      ]}
    >
      {children}
    </Form>
  );
}

/** Controlled native input with secure entry, keyboard and autofill semantics. */
export function NativeSettingsTextFieldRow({
  label,
  placeholder,
  value,
  onChange,
  secure = false,
  numeric = false,
  contentType,
  disabled: unavailable = false,
  onSubmit: submit,
  autoFocus = false,
  search = false,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
  numeric?: boolean;
  contentType?: 'password' | 'oneTimeCode' | 'username';
  disabled?: boolean;
  onSubmit?: () => void;
  autoFocus?: boolean;
  search?: boolean;
}) {
  const { theme } = useTheme();
  const field = useRef<TextInputRef>(null);
  return (
    <ControlledTextInput
      ref={field}
      value={value}
      placeholder={placeholder ?? label}
      onChangeText={onChange}
      autoFocus={autoFocus}
      accessibilityLabel={label}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={secure}
      editable={!unavailable}
      autoComplete={
        contentType === 'password'
          ? 'current-password'
          : contentType === 'oneTimeCode'
            ? 'one-time-code'
            : contentType
      }
      returnKeyType={search ? 'search' : 'done'}
      onSubmitEditing={() => {
        void field.current?.blur();
        submit?.();
      }}
      modifiers={[
        accessibilityLabel(label),
        keyboardType(numeric ? 'ascii-capable-number-pad' : 'default'),
        disabled(unavailable),
        foregroundStyle(theme.colors.ink),
        listRowBackground(theme.colors.surface),
      ]}
    />
  );
}

export function NativeSettingsSection({
  title,
  footer,
  children,
}: PropsWithChildren<{ title?: string; footer?: string }>) {
  const { theme } = useTheme();
  return (
    <Section
      title={title}
      footer={
        footer ? (
          <Text modifiers={[foregroundStyle(theme.colors.inkMuted)]}>
            {footer}
          </Text>
        ) : undefined
      }
    >
      {children}
    </Section>
  );
}
export function NativeSettingsNavigationRow({
  label,
  value,
  description,
  leading,
  onPress,
}: {
  label: string;
  value?: string;
  description?: string;
  leading?: ReactNode;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const stacked = useWindowDimensions().fontScale >= 1.5;
  return (
    <Button
      onPress={onPress}
      modifiers={[listRowBackground(theme.colors.surface)]}
    >
      <HStack spacing={12}>
        <Label icon={leading} modifiers={[foregroundStyle(theme.colors.ink)]}>
          <VStack alignment="leading" spacing={3}>
            <Text>{label}</Text>
            {stacked && value && (
              <Text modifiers={[foregroundStyle(theme.colors.inkMuted)]}>
                {value}
              </Text>
            )}
            {description && (
              <Text
                modifiers={[
                  font({
                    family: 'Nunito-SemiBold',
                    size: 14,
                    textStyle: 'footnote',
                  }),
                  foregroundStyle(theme.colors.inkMuted),
                ]}
              >
                {description}
              </Text>
            )}
          </VStack>
        </Label>
        <Spacer />
        {!stacked && value && (
          <Text modifiers={[foregroundStyle(theme.colors.inkMuted)]}>
            {value}
          </Text>
        )}
        <Image
          systemName="chevron.right"
          size={12}
          modifiers={[
            foregroundStyle(theme.colors.inkMuted),
            accessibilityHidden(true),
          ]}
        />
      </HStack>
    </Button>
  );
}
/** A native menu picker row: SwiftUI owns presentation, selection and dismissal. */
export function NativeSettingsPickerRow<T extends string>({
  label,
  leading,
  value,
  options,
  onChange,
  disabled: unavailable = false,
}: {
  label: string;
  leading?: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Picker
      label={
        <Label
          title={label}
          icon={leading}
          modifiers={[foregroundStyle(theme.colors.ink)]}
        />
      }
      selection={value}
      onSelectionChange={onChange}
      modifiers={[
        pickerStyle('menu'),
        disabled(unavailable),
        listRowBackground(theme.colors.surface),
      ]}
    >
      {options.map((option) => (
        <Text key={option.value} modifiers={[tag(option.value)]}>
          {option.label}
        </Text>
      ))}
    </Picker>
  );
}

export function NativeSettingsRow({
  label,
  value,
  description,
}: {
  label: string;
  value?: string;
  description?: string;
}) {
  const { theme } = useTheme();
  const stacked = useWindowDimensions().fontScale >= 1.5;
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        listRowBackground(theme.colors.surface),
        foregroundStyle(theme.colors.ink),
      ]}
    >
      {stacked ? (
        <>
          <Text>{label}</Text>
          {value && (
            <Text modifiers={[foregroundStyle(theme.colors.inkMuted)]}>
              {value}
            </Text>
          )}
        </>
      ) : (
        <HStack>
          <Text>{label}</Text>
          {value && (
            <>
              <Spacer />
              <Text modifiers={[foregroundStyle(theme.colors.inkMuted)]}>
                {value}
              </Text>
            </>
          )}
        </HStack>
      )}
      {description && (
        <Text
          modifiers={[
            font({
              family: 'Nunito-SemiBold',
              size: 14,
              textStyle: 'footnote',
            }),
            foregroundStyle(theme.colors.inkMuted),
          ]}
        >
          {description}
        </Text>
      )}
    </VStack>
  );
}
export function NativeSettingsActionRow({
  label,
  onPress,
  disabled: unavailable = false,
  destructive = false,
  accessibilityLabel: accessibleName,
  leading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  leading?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Button
      role={destructive ? 'destructive' : 'default'}
      onPress={onPress}
      modifiers={[
        disabled(unavailable),
        listRowBackground(theme.colors.surface),
        foregroundStyle(
          destructive ? theme.colors.dangerText : theme.colors.brandText,
        ),
        ...(accessibleName ? [accessibilityLabel(accessibleName)] : []),
      ]}
    >
      <HStack>
        <Label title={label} icon={leading} />
        <Spacer />
      </HStack>
    </Button>
  );
}
