import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { useTheme } from '../../theme/theme';
import { Callout, CalloutStrong } from './callout';
import { Card } from './card';
import { Eyebrow } from './eyebrow';
import { LegendItem } from './legend';
import { ProgressBar } from './progress-bar';

const meta = {
  title: 'UI/Callout, legend and bars',
  component: Callout,
  args: { icon: 'up', children: 'Blunders are down 25% since you started' },
  decorators: [
    (Story) => (
      <View style={{ padding: 16, maxWidth: 390 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Callout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Muted: Story = {
  args: { tone: 'muted', icon: 'clock', children: 'Updated a minute ago' },
};
export const WithEmphasis: Story = {
  render: () => (
    <Callout icon="up">
      <CalloutStrong>3 positions</CalloutStrong>
      {' moved to long-term memory today'}
    </Callout>
  ),
};

function Legends() {
  const { theme } = useTheme();
  return (
    <Card eyebrow="Legend">
      <LegendItem
        swatch={{ kind: 'dot', color: theme.colors.brand }}
        label="Long-term"
        count={61}
      />
      <LegendItem
        swatch={{ kind: 'ring', color: theme.colors.inkMuted }}
        label="New"
        count={27}
      />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <LegendItem
          swatch={{ kind: 'line', color: theme.colors.brand }}
          label="Now"
        />
        <LegendItem
          swatch={{ kind: 'dash', color: theme.colors.inkMuted }}
          label="90 days ago"
        />
      </View>
    </Card>
  );
}
export const Legend: Story = { render: () => <Legends /> };

/** The weakest bar carries its word as well as its colour. */
export const Bars: Story = {
  render: () => (
    <Card eyebrow="Tactics" meta="Solved on the first try">
      <Eyebrow tone="muted">Weakest · Forks 41%</Eyebrow>
      <ProgressBar value={41} tone="weak" size="sm" label="Forks, 41%" />
      <Eyebrow tone="muted">Pins 57%</Eyebrow>
      <ProgressBar value={57} size="sm" label="Pins, 57%" />
      <Eyebrow tone="muted">3 of 10 games analyzed</Eyebrow>
      <ProgressBar value={3} max={10} label="3 of 10 games analyzed" />
    </Card>
  ),
};
