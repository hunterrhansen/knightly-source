import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { PracticePreview } from './practice-preview';

const meta = {
  title: 'Practice/Daily practice',
  component: PracticePreview,
  decorators: [
    (Story) => (
      <View style={{ minHeight: 900, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof PracticePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Position: Story = {};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <View style={{ width: 390, minHeight: 844 }}>
        <Story />
      </View>
    ),
  ],
};
/** "What do they threaten?": the opponent moves as if you passed. */
export const ThreatQuestion: Story = {
  ...Narrow,
  args: { question: 'threat' },
};
/** The same question where nothing is threatened. */
export const CalmQuestion: Story = { ...Narrow, args: { question: 'calm' } };
/** "What did your move allow?": their reply, after your own move plays in. */
export const AllowsQuestion: Story = {
  ...Narrow,
  args: { question: 'allows' },
};
/** A loose piece: your own capture, no "nothing there" button. */
export const VisionQuestion: Story = {
  ...Narrow,
  args: { question: 'vision' },
};
export const EmptyDeckAnalyzing: Story = {
  ...Narrow,
  args: { empty: { games: { analyzed: 3, pending: 9 } } },
};
export const EmptyDeckCleanGames: Story = {
  ...Narrow,
  args: { empty: { games: { analyzed: 4, pending: 0 } } },
};
export const Loading: Story = {
  ...Narrow,
  args: { loadDelay: 4500 },
};
/** The daily lesson's frame: the lesson seen from the castle wall. */
export const Watch: Story = { ...Narrow, args: { watch: true } };
/** The smallest supported phone: the board gives way to the wall's words. */
export const WatchSmallPhone: Story = {
  args: { watch: true },
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 568 }}>
        <Story />
      </View>
    ),
  ],
};
