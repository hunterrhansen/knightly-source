import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { AppearanceSettings } from './appearance-settings';

const meta = {
  title: 'UI/Appearance pickers',
  component: AppearanceSettings,
  args: { onOpenChoice: () => {} },
  render: function AppearancePreview(args) {
    const [choice, setChoice] = useState(args.choice);
    return (
      <AppearanceSettings {...args} choice={choice} onOpenChoice={setChoice} />
    );
  },
  decorators: [
    (Story) => (
      <View style={{ padding: 24, width: '100%', maxWidth: 500, height: 500 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof AppearanceSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Display: Story = {};
export const BoardColors: Story = { args: { choice: 'board' } };
