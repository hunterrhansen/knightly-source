import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { BoardLabDemo } from './board-lab-demo';

const meta = {
  title: 'Chess/Feature demos',
  component: BoardLabDemo,
  decorators: [
    (Story) => (
      <View style={{ maxWidth: 1100, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof BoardLabDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Practice: Story = { args: { mode: 'practice' } };
export const Review: Story = { args: { mode: 'review' } };
export const FlippedLargeText: Story = {
  args: { mode: 'practice', orientation: 'b', textScale: 2 },
};
