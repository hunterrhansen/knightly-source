import { Column, Picker, Row, Spacer, Text } from '@expo/ui';
import type { ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/theme';
import { ControlHost } from './control-host';

type SettingsPickerProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  leading?: ReactNode;
};

export function SettingsPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  leading,
}: SettingsPickerProps<T>) {
  const { theme } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.5;
  const Container = stacked ? Column : Row;
  const content = (
    <Container
      alignment={stacked ? 'start' : 'center'}
      spacing={theme.spacing.sm}
      style={{
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Row alignment="center" spacing={theme.spacing.sm}>
        {leading}
        <Text
          textStyle={{
            color: theme.colors.ink,
            fontSize: theme.typography.size.body,
            fontFamily:
              Platform.OS === 'ios' ? 'Nunito-SemiBold' : theme.typography.body,
          }}
        >
          {label}
        </Text>
      </Row>
      {!stacked && <Spacer flexible />}
      <Picker
        accessibilityLabel={label}
        selectedValue={value}
        appearance="menu"
        enabled={!disabled}
        onValueChange={(next) => {
          if (!disabled && options.some((option) => option.value === next))
            onChange(next);
        }}
      >
        {options.map((option) => (
          <Picker.Item
            key={option.value}
            label={option.label}
            value={option.value}
          />
        ))}
      </Picker>
    </Container>
  );
  return (
    <ControlHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
      {content}
    </ControlHost>
  );
}
