import type { ReactNode } from 'react';
import { I18nManager, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { ListItem } from './list-item';

export function SettingsNavigationRow({
  label,
  description,
  value,
  leading,
  onPress,
  disabled = false,
}: {
  label: string;
  description?: string;
  value?: string;
  leading?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  return (
    <ListItem
      label={label}
      description={description}
      leading={leading}
      onPress={onPress}
      disabled={disabled}
      groupPosition="middle"
      accessibilityLabel={[label, value, description]
        .filter(Boolean)
        .join(', ')}
      trailing={
        <View style={styles.accessory}>
          {!!value && <Text style={styles.value}>{value}</Text>}
          <View
            accessible={false}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Svg width={8} height={14} viewBox="0 0 8 14">
              <Path
                d={I18nManager.isRTL ? 'M6 1 1 7l5 6' : 'm2 1 5 6-5 6'}
                fill="none"
                stroke={theme.colors.inkMuted}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>
      }
    />
  );
}
const useStyles = createStyles((theme) => ({
  accessory: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: {
    flexShrink: 1,
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.inkMuted,
  },
}));
