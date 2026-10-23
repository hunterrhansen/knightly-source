import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { ActionBar, ActionButton } from './action-bar';

const noop = () => {};

const meta = {
  title: 'UI/Action bar',
  component: ActionBar,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, maxWidth: 390 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ActionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Actions below a board; each squashes on press, the next step in brand. */
export const Default: Story = {
  render: () => (
    <ActionBar>
      <ActionButton icon="hint" label="Hint" onPress={noop} />
      <ActionButton icon="retry" label="Retry" onPress={noop} />
      <ActionButton icon="forward" label="Next" primary onPress={noop} />
    </ActionBar>
  ),
};
