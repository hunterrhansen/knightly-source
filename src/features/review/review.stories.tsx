import type { Meta, StoryObj } from '@storybook/react-native';
import { useWindowDimensions, View } from 'react-native';
import { ReviewPreview } from './review-preview';

const meta = {
  title: 'Review/Game review',
  component: ReviewPreview,
  decorators: [
    (Story) => (
      <View style={{ minHeight: 900, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ReviewPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Summary: Story = {};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <View style={{ width: 390, minHeight: 844 }}>
        <Story />
      </View>
    ),
  ],
};
export const Loading: Story = {
  ...Narrow,
  args: { loadDelay: 4500 },
};
// The board beside a side panel (desktop browsers, landscape tablets), in a
// window-height frame as the app's fixed screen gives it.
export const Desktop: Story = {
  decorators: [
    (Story) => (
      <WindowHeight>
        <Story />
      </WindowHeight>
    ),
  ],
};
function WindowHeight({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return <View style={{ width: '100%', height }}>{children}</View>;
}
