import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { IconButton } from './icon-button';

const meta = {
  title: 'UI/Icon button',
  component: IconButton,
  args: { icon: 'close', accessibilityLabel: 'Close', onPress: () => {} },
  decorators: [
    (Story) => (
      <View style={{ padding: 24, flexDirection: 'row' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Muted: Story = { args: { tone: 'muted' } };
export const Brand: Story = { args: { icon: 'list', tone: 'brand' } };
export const Compact: Story = {
  args: { icon: 'next', compact: true, iconSize: 20 },
};
export const Surface: Story = {
  args: { icon: 'next', iconSize: 30, backdrop: 'surface' },
};
export const Disabled: Story = { args: { icon: 'previous', disabled: true } };
