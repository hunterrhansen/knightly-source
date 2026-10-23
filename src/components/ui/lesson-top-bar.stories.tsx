import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from './button';
import { LessonTopBar } from './lesson-top-bar';

const meta = {
  title: 'UI/Lesson top bar',
  component: LessonTopBar,
  args: { done: 3, current: 3, total: 10, combo: 0 },
  decorators: [
    (Story) => (
      <View style={{ padding: 16, maxWidth: 420 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof LessonTopBar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const ThreeInARow: Story = { args: { done: 3, current: 3, combo: 3 } };
export const FiveInARow: Story = { args: { done: 5, current: 5, combo: 5 } };
export const SevenInARow: Story = { args: { done: 7, current: 7, combo: 7 } };
export const AlmostThere: Story = { args: { done: 8, current: 8, combo: 2 } };
export const Complete: Story = { args: { done: 10, current: 10, combo: 4 } };
export const LongSession: Story = {
  args: { done: 18, current: 18, total: 30, combo: 6 },
};
export const GroupedSession: Story = {
  args: { done: 25, current: 25, total: 60, combo: 0 },
};

/** Play a session: first tries, hints and misses drive the real motion. */
function Playground() {
  const [state, setState] = useState({ done: 0, combo: 0, misses: 0 });
  const total = 8;
  const answer = (kind: 'clean' | 'hint' | 'miss') =>
    setState((s) =>
      kind === 'miss'
        ? { ...s, combo: 0, misses: s.misses + 1 }
        : s.done >= total
          ? s
          : {
              ...s,
              done: s.done + 1,
              combo: kind === 'clean' ? s.combo + 1 : 0,
            },
    );
  return (
    <View style={{ gap: 16 }}>
      <LessonTopBar
        done={state.done}
        current={state.done}
        total={total}
        combo={state.combo}
        misses={state.misses}
        onExit={() => {}}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button onPress={() => answer('clean')}>First try</Button>
        <Button variant="secondary" onPress={() => answer('hint')}>
          With a hint
        </Button>
        <Button variant="secondary" onPress={() => answer('miss')}>
          Missed
        </Button>
        <Button
          variant="secondary"
          onPress={() => setState({ done: 0, combo: 0, misses: 0 })}
        >
          Restart
        </Button>
      </View>
    </View>
  );
}
export const Playable: Story = { render: () => <Playground /> };
