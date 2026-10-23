import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/theme';
import { Button } from './button';
import {
  Burst,
  CountUp,
  Shine,
  Sparkles,
  useRewardCue,
} from './reward-effects';

/** Each effect fires together on Play, with the reward cue as the count ends. */
function Playground() {
  const { theme } = useTheme();
  const cue = useRewardCue();
  const [fire, setFire] = useState(0);
  const [done, setDone] = useState(0);
  const tile = {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gold,
    overflow: 'hidden',
  } as const;
  const label = {
    color: theme.colors.onGold,
    fontFamily: theme.typography.heading,
    fontSize: 30,
  } as const;
  return (
    <View style={{ gap: 32, padding: 24, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 32, flexWrap: 'wrap' }}>
        <View style={{ width: 120, height: 120 }}>
          <Burst
            fire={fire}
            color={theme.colors.gold}
            style={{ left: 45, top: 45, width: 30, height: 30 }}
          />
        </View>
        <View style={{ width: 120, height: 120 }}>
          <Sparkles fire={fire} color={theme.colors.gold} reach={50} />
        </View>
        <View style={tile}>
          <Text style={label}>Shine</Text>
          <Shine fire={fire} />
        </View>
        <View style={tile}>
          <Text style={label}>
            {fire ? (
              <CountUp
                key={fire}
                to={120}
                onDone={() => {
                  setDone((n) => n + 1);
                  cue('reward');
                }}
              />
            ) : (
              '0'
            )}
          </Text>
          <Shine fire={done} />
        </View>
      </View>
      <Button onPress={() => setFire((n) => n + 1)}>Play</Button>
    </View>
  );
}

const meta = {
  title: 'UI/Reward effects',
  component: Playground,
} satisfies Meta<typeof Playground>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Effects: Story = {};
