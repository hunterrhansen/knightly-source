import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ToggleGroup } from './toggle-group';

const periods = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;
type Period = (typeof periods)[number]['value'];

function Example({
  variant,
  fullWidth,
}: {
  variant?: 'segmented' | 'pills';
  fullWidth?: boolean;
}) {
  const [value, setValue] = useState<Period>('week');
  return (
    <ToggleGroup
      label="Period"
      value={value}
      options={periods}
      onChange={setValue}
      variant={variant}
      fullWidth={fullWidth}
    />
  );
}

const meta = {
  title: 'UI/Toggle group',
  component: Example,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, maxWidth: 390, gap: 16 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each choice squashes on press, like every tappable surface. */
export const Segmented: Story = {};

/** Full-width options share the track equally. */
export const FullWidth: Story = { args: { fullWidth: true } };

export const Pills: Story = { args: { variant: 'pills' } };
