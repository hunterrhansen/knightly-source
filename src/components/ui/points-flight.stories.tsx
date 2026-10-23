import type { Meta, StoryObj } from '@storybook/react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import {
  type PointsAward,
  PointsLedger,
  pointsFor,
} from '../../lib/lesson-points';
import { Button } from './button';
import { LessonTopBar } from './lesson-top-bar';
import { PointsFlight, PointsFlightProvider } from './points-flight';

const BOARD = 320;
const squares = Array.from({ length: 64 }, (_, i) => i);

/** A plain board for the story: the flight only needs its size. */
function Board({ award }: { award?: PointsAward }) {
  return (
    <View style={{ width: BOARD, height: BOARD, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: BOARD }}>
        {squares.map((i) => (
          <View
            key={i}
            style={{
              width: BOARD / 8,
              height: BOARD / 8,
              backgroundColor:
                (Math.floor(i / 8) + (i % 8)) % 2 ? '#6f9450' : '#d9dfc2',
            }}
          />
        ))}
      </View>
      <PointsFlight award={award} orientation="w" size={BOARD} />
    </View>
  );
}

function Playground() {
  const ledger = useRef(new PointsLedger());
  const count = useRef(0);
  const [state, setState] = useState<{
    done: number;
    combo: number;
    points: number;
    award?: PointsAward;
  }>({ done: 0, combo: 0, points: 0 });
  const answer = (clean: boolean) => {
    count.current += 1;
    const combo = clean ? state.combo + 1 : 0;
    const award = ledger.current.record(
      `p${count.current}`,
      pointsFor(clean ? 'clean' : 'helped', combo),
      ['c7', 'f7', 'e4', 'g5', 'b8'][count.current % 5],
    );
    setState({
      done: Math.min(12, state.done + 1),
      combo,
      points: ledger.current.total,
      award: award ?? state.award,
    });
  };
  return (
    <PointsFlightProvider>
      <View style={{ gap: 16 }}>
        <LessonTopBar
          done={state.done}
          current={state.done}
          total={12}
          combo={state.combo}
          points={state.points}
          award={state.award}
          onExit={() => {}}
        />
        <Board award={state.award} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button onPress={() => answer(true)}>First try</Button>
          <Button variant="secondary" onPress={() => answer(false)}>
            With a hint
          </Button>
        </View>
      </View>
    </PointsFlightProvider>
  );
}

const meta = {
  title: 'UI/Points flight',
  component: Playground,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, maxWidth: 420 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Playground>;
export default meta;
type Story = StoryObj<typeof meta>;
/** First try five times in a row to see the run-bonus coin. */
export const Playable: Story = {};
