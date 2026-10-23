import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { Card } from './card';
import { Delta } from './delta';
import { StatTile } from './stat-tile';

const meta = {
  title: 'UI/Stat tile and delta',
  component: StatTile,
  args: { value: '23', unit: '/ 28', label: 'nights practiced' },
  decorators: [
    (Story) => (
      <View style={{ padding: 16, maxWidth: 390 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof StatTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Habit card pair: blunders falling is good, so the arrow points down in green. */
export const HabitPair: Story = {
  render: () => (
    <Card eyebrow="Last 4 weeks" meta="14 nights in a row">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile value="23" unit="/ 28" label="nights practiced" />
        <StatTile
          value="1.8"
          label="blunders per game"
          change={<Delta change={-0.6} better="down" digits={1} size="small" />}
        />
      </View>
    </Card>
  ),
};

/** Every delta state: good and bad in both directions, no change, no comparison. */
export const Deltas: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <Delta change={49} suffix="· 90 days" />
      <Delta change={-27} suffix="· 30 days" />
      <Delta change={-0.6} better="down" digits={1} />
      <Delta change={0.4} better="down" digits={1} />
      <Delta change={0} />
      <Delta change={null} />
    </View>
  ),
};

/** Large text wraps the value row instead of clipping. */
export const NoDataYet: Story = {
  args: { value: '—', label: 'blunders per game' },
  render: (args) => (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <StatTile value="2" unit="/ 28" label="nights practiced" />
      <StatTile
        {...args}
        change={<Delta change={null} size="small" suffix="after 10 games" />}
      />
    </View>
  ),
};
