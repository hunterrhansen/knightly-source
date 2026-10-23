import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from './button';
import { KnightMascot, type KnightMood } from './knight-mascot';

const moods: KnightMood[] = [
  'idle',
  'thinking',
  'cheer',
  'encourage',
  'sleepy',
  'celebrate',
];

/** Every mood side by side, with a replay for the one-off ones. */
function AllMoods({ size }: { size: number }) {
  const [play, setPlay] = useState(0);
  return (
    <View style={{ padding: 24, gap: 24 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
        {moods.map((mood) => (
          <View key={mood} style={{ alignItems: 'center', gap: 8 }}>
            <KnightMascot mood={mood} size={size} play={play} />
            <Text>{mood}</Text>
          </View>
        ))}
      </View>
      <Button onPress={() => setPlay((n) => n + 1)}>Replay</Button>
    </View>
  );
}

const meta = {
  title: 'UI/Knight mascot (stand-in)',
  component: AllMoods,
  args: { size: 96 },
} satisfies Meta<typeof AllMoods>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Moods: Story = {};
export const CoachSize: Story = { args: { size: 44 } };
