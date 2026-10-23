import type { TextInputRef } from '@expo/ui';
import {
  Button,
  Host,
  HStack,
  Image,
  Picker,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  padding,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { ControlledTextInput } from '../../ui/controlled-text-input';
import { type GamesControlsProps, scopeOptions } from './games-controls-types';

export function GamesControls({
  search,
  onSearch,
  scope,
  onScope,
  filterCount,
  onFilters,
}: GamesControlsProps) {
  const { theme } = useTheme();
  const { fontScale } = useWindowDimensions();
  const field = useRef<TextInputRef>(null);
  return (
    <Host
      matchContents={{ vertical: true }}
      style={{ width: '100%' }}
      colorScheme="dark"
      seedColor={theme.colors.brandText}
    >
      <VStack
        spacing={12}
        modifiers={[
          font({ family: 'Nunito-SemiBold', size: 16, textStyle: 'body' }),
          foregroundStyle(theme.colors.ink),
        ]}
      >
        <HStack spacing={8}>
          <ControlledTextInput
            ref={field}
            value={search}
            onChangeText={onSearch}
            accessibilityLabel="Search opponents or openings"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              field.current?.blur();
            }}
            maxLength={200}
            placeholder="Opponent or opening"
            modifiers={[
              accessibilityLabel('Search opponents or openings'),
              padding({ horizontal: 14, vertical: 12 }),
              background(theme.colors.surfaceMuted),
              cornerRadius(theme.radius.control),
            ]}
          />
          <Button
            onPress={onFilters}
            modifiers={[
              buttonStyle('plain'),
              accessibilityLabel(
                filterCount ? `Filters, ${filterCount} active` : 'Filters',
              ),
              padding({ horizontal: 12, vertical: 12 }),
              background(theme.colors.surfaceMuted),
              cornerRadius(theme.radius.control),
              frame({ minWidth: 48, minHeight: 48 }),
              foregroundStyle(theme.colors.brandText),
            ]}
          >
            <HStack spacing={4}>
              <Image systemName="line.3.horizontal.decrease" size={20} />
              {filterCount > 0 && <Text>{String(filterCount)}</Text>}
            </HStack>
          </Button>
        </HStack>
        <Picker
          label="Show games"
          selection={scope}
          onSelectionChange={onScope}
          modifiers={[
            pickerStyle(fontScale >= 1.4 ? 'menu' : 'segmented'),
            accessibilityLabel('Show games'),
          ]}
        >
          {scopeOptions.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </VStack>
    </Host>
  );
}
