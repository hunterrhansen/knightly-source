import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import type { ProgressRange } from '../../lib/api/progress-contract';
import { climbing, firstNights, noNights, scheduled } from '../today/today-api';
import {
  dip,
  improving,
  manyGames,
  newPlayer,
  recentDip,
  recentImproving,
  sampleHabit,
  samplePatterns,
  sampleToday,
} from './progress-samples';
import { ProgressView, type ProgressViewProps } from './progress-view';

const ready = <T,>(data: T) => ({
  data,
  error: null,
  isFetching: false,
  refetch: () => {},
});
const waiting = { error: null, isFetching: true, refetch: () => {} };

const props: ProgressViewProps = {
  journey: ready({
    ...firstNights,
    moves: { on_watch: 27, held: 54, stopped: 0 },
  }),
  streak: {
    count: 4,
    best: 4,
    freezes: 0,
    safe_today: true,
    week: [],
    nights_total: 4,
  },
  onTheirWay: 14,
  range: '90d',
  onRange: () => {},
  overview: ready(improving),
  habit: {
    today: sampleToday,
    ...sampleHabit('dxddddddxdddxdddddddddddddd'),
    recent: ready({ ...improving, ...recentImproving }),
  },
  patterns: ready(samplePatterns),
  deck: ready({ total: 142, mastered: 61, learning: 54, new: 27 }),
  onOpen: () => {},
};

function Sheet(args: ProgressViewProps) {
  const [range, setRange] = useState<ProgressRange>(args.range);
  return <ProgressView {...args} range={range} onRange={setRange} />;
}

const meta = {
  title: 'Progress/Sheet',
  component: ProgressView,
  render: (args) => <Sheet {...args} />,
  decorators: [
    (Story) => (
      <View style={{ height: 2400, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ProgressView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every learner today: Page, no star yet, the first star card, then the
 * whole sheet. */
export const FirstNights: Story = { args: props };

/** No star yet, with the held move closest to 11 days as progress. */
export const FirstStarProgress: Story = {
  args: { ...props, journey: ready(scheduled) },
};

/** Weeks in: Squire II, 23 stars with one dimmed after a lapse. */
export const Climbing: Story = {
  args: {
    ...props,
    journey: ready({
      ...climbing,
      moves: { on_watch: 12, held: 40, stopped: 23 },
    }),
  },
};

/** Before the first watch: a new player's rating count, empty month, locked
 * shape, and In your games counting the games still needed. */
export const FirstNight: Story = {
  args: {
    ...props,
    journey: ready(noNights),
    overview: ready(newPlayer),
    habit: { ...props.habit, ...sampleHabit('dd'), recent: ready(newPlayer) },
    patterns: ready({ range: '90d', patterns: [], pending: 0 }),
    deck: ready({ total: 4, mastered: 0, learning: 0, new: 4 }),
    onTheirWay: 0,
  },
};

/** Rating down this month while blunders keep falling. */
export const RatingDip: Story = {
  args: {
    ...props,
    range: '30d',
    overview: ready(dip),
    habit: {
      ...props.habit,
      ...sampleHabit('ddxdddddddxddddxddddddddddd'),
      recent: ready({ ...dip, ...recentDip }),
    },
  },
};

export const ManyGames: Story = {
  args: { ...props, range: 'all', overview: ready(manyGames) },
};

export const Loading: Story = {
  args: {
    ...props,
    journey: waiting,
    overview: waiting,
    patterns: waiting,
    habit: { ...props.habit, recent: waiting },
  },
};

/** The journey's request failed (or an older server has none): the rest
 * still shows. */
export const RankUnavailable: Story = {
  args: {
    ...props,
    journey: {
      error: new Error('Connection unavailable.'),
      isFetching: false,
      refetch: () => {},
    },
  },
};

/** The rating's request failed; the last four weeks still show. */
export const PartialFailure: Story = {
  args: {
    ...props,
    overview: {
      error: new Error('Connection unavailable.'),
      isFetching: false,
      refetch: () => {},
    },
  },
};

export const Narrow: Story = {
  args: { ...props, journey: ready(climbing) },
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 2400 }}>
        <Story />
      </View>
    ),
  ],
};
