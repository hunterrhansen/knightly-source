import type { Meta, StoryObj } from '@storybook/react-native';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard } from '../../chess/board';
import { Button } from '../../ui';
import { demoPromotion, demoStart, useBoardDemo } from './use-board-demo';

// Development fixture: observes the real callback; no board/gesture mocks.
function RuntimeBoard({ initialFen = demoStart }: { initialFen?: string }) {
  const demo = useBoardDemo(initialFen);
  const [attempts, setAttempts] = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(resetTimer.current), []);
  return (
    <View style={{ width: 320, maxWidth: '100%', gap: 16 }}>
      <Chessboard
        position={demo.position}
        orientation="w"
        policy={demo.policy}
        feedback={demo.feedback}
        presentation={{
          showDestinations: true,
          lastMove: demo.lastMove,
          transition: demo.transition,
          highlights: [],
          arrows: [],
        }}
        onAttempt={(attempt) => {
          setAttempts((value) => value + 1);
          demo.onAttempt(attempt);
        }}
      />
      <Text>Attempts: {attempts}</Text>
      <Button
        onPress={() => {
          clearTimeout(resetTimer.current);
          resetTimer.current = setTimeout(demo.reset, 1000);
        }}
      >
        Reset in one second
      </Button>
    </View>
  );
}

const meta = {
  title: 'Chess/Runtime journeys',
  component: RuntimeBoard,
} satisfies Meta<typeof RuntimeBoard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MoveInput: Story = {};
export const PromotionReset: Story = { args: { initialFen: demoPromotion } };
