import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { GamesPreview } from './games-preview';

const meta = {
  title: 'Games/Library',
  component: GamesPreview,
  decorators: [
    (Story) => (
      <View style={{ height: 1000, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof GamesPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 1100 }}>
        <Story />
      </View>
    ),
  ],
};
export const Unlinked: Story = { args: { state: 'unlinked' } };
export const CaughtUp: Story = { args: { state: 'caught-up' } };
export const Loading: Story = { args: { state: 'loading' } };
export const RefreshError: Story = { args: { state: 'error' } };
