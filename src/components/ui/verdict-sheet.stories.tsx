import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { praiseFor, VerdictSheet } from './verdict-sheet';

const meta = {
  title: 'UI/Verdict sheet',
  component: VerdictSheet,
  args: {
    tone: 'right',
    title: praiseFor('story'),
    secondary: { label: 'Analyse', onPress: () => {} },
    primary: { label: 'Continue', advances: true, onPress: () => {} },
  },
  decorators: [
    (Story) => (
      <View style={{ maxWidth: 420 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof VerdictSheet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Right: Story = {};
export const Wrong: Story = {
  args: {
    tone: 'wrong',
    title: 'Not quite',
    secondary: { label: 'Solution', onPress: () => {} },
    primary: { label: 'Try again', onPress: () => {} },
  },
};
export const SolutionShown: Story = {
  args: { badge: false, title: 'Here’s the line' },
};
/** The chips pop in with sparkles and a shine. */
export const RightWithPoints: Story = {
  args: { points: { base: 10, bonus: 10 } },
};
