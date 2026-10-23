import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { Button } from './button';

const meta = {
  title: 'UI/Solid ledge button',
  component: Button,
  args: { children: 'Continue learning', onPress: () => {} },
  decorators: [
    (Story) => (
      <View style={{ padding: 24, maxWidth: 320 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Disabled: Story = { args: { disabled: true } };
export const DoubleText: Story = { args: { textScale: 2 } };
export const Text: Story = { args: { variant: 'text', children: 'Not now' } };
export const WithIcon: Story = {
  args: { icon: 'retry', children: 'Try again' },
};
export const BarAction: Story = {
  args: {
    icon: 'hint',
    iconPlacement: 'top',
    variant: 'ghost',
    children: 'Hint',
  },
};

export const Continue: Story = {
  args: { icon: 'forward', iconPlacement: 'end', children: 'Continue' },
};
