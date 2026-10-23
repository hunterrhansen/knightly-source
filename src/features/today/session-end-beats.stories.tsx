import type { Meta, StoryObj } from '@storybook/react-native';
import { Text, View } from 'react-native';
import { pointsStat } from '../../ui';
import { firstNights } from './journey-samples';
import { PostBeat } from './post-beat';
import {
  MemoryBeat,
  type RankUp,
  RankUpBeat,
  SessionBeats,
  StreakBeat,
  type StreakExtension,
} from './session-end-beats';
import { postMoment } from './ward-path';
import { sampleWards } from './ward-samples';

const rankUp: RankUp = {
  rank: 'Squire I',
  key: 'squire-1',
  stars: 10,
  nextRank: 'Squire II',
  nextPost: 6,
  latest: [
    ['Loose piece', 'Nf5', '2026-10-14'],
    ['Fork', 'Qd4', '2026-10-13'],
    ['Missed threat', 'h3', '2026-10-11'],
  ].map(([label = '', san = '', earned_on = ''], i) => ({
    game_id: 40 + i,
    ply: 21 + i,
    label,
    san,
    earned_on,
    dimmed: false,
  })),
};

const streak: StreakExtension = {
  from: 12,
  to: 13,
  day: '2026-10-14',
  week: (
    [
      'done',
      'done',
      'done',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ] as const
  ).map((state, i) => ({
    date: `2026-10-${12 + i}`,
    state,
    // Nights 11–13: the beat's moon waxes from night 12's phase to 13's.
    night: state === 'done' ? 11 + i : null,
  })),
};

const meta = {
  title: 'Today/Session-end beats',
  component: SessionBeats,
  args: {
    results: {
      title: 'Practice complete',
      coach: 'Solid session. Your next reviews are scheduled.',
      stats: [
        { label: 'Found', value: '7', tone: 'brand', icon: 'check' },
        { label: 'Accuracy', value: '78%', tone: 'gold', icon: 'best' },
        {
          label: 'Time',
          value: '6:24',
          spoken: '6 minutes 24 seconds',
          tone: 'sky',
          icon: 'clock',
        },
      ],
      details: <Text>Per-position results</Text>,
    },
    finish: { label: 'Done', onPress: () => {} },
  },
  decorators: [
    (Story) => (
      <View style={{ height: 760, width: '100%', maxWidth: 430 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof SessionBeats>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {};
/** Points first, counting up, with how they were earned under the cards. */
export const ResultsWithPoints: Story = {
  args: {
    results: {
      title: 'Practice complete',
      coach: 'Every one on your own. Sharp work!',
      stats: [
        pointsStat(130),
        { label: 'First try', value: '100%', tone: 'brand', icon: 'check' },
        {
          label: 'Time',
          value: '4:12',
          spoken: '4 minutes 12 seconds',
          tone: 'sky',
          icon: 'clock',
        },
      ],
      breakdown: [
        { label: '10 first tries', value: '+100' },
        { label: 'Run bonus', value: '+10' },
        { label: 'Perfect session', value: '+20' },
      ],
      details: <Text>Per-position results</Text>,
    },
  },
};
/** Opened after the session ended: no measured time, so what to revisit. */
export const ResultsWithoutTime: Story = {
  args: {
    results: {
      title: 'Review complete',
      coach: 'You found 2 of 4 better moves on your own.',
      stats: [
        { label: 'Found', value: '2', tone: 'brand', icon: 'check' },
        { label: 'Accuracy', value: '50%', tone: 'gold', icon: 'best' },
        { label: 'To revisit', value: '1', tone: 'sky', icon: 'retry' },
      ],
      secondary: { label: 'Review again', onPress: () => {} },
    },
  },
};
/** Results first; Continue plays the streak and long-term memory beats. */
export const StreakAndMemory: Story = { args: { streak, mastered: 2 } };
/** The streak beat on its own: moon, rolling count, week and today's check. */
export const StreakExtended: Story = {
  render: () => (
    <StreakBeat
      streak={streak}
      primary={{ label: 'Done', onPress: () => {} }}
    />
  ),
};
/** Streak extended, then Rank up in place of Long-term memory. */
export const StreakAndRankUp: Story = {
  args: { streak, mastered: 1, rankUp },
};
/** The rank-up beat on its own: the emblem drops onto the night-sky disc. */
export const RankUpOnly: Story = {
  render: () => (
    <RankUpBeat
      rankUp={rankUp}
      today="2026-10-14"
      primary={{ label: 'Done', onPress: () => {} }}
    />
  ),
};
/** Knight I: the gold emblem and its crown. */
export const RankUpKnight: Story = {
  render: () => (
    <RankUpBeat
      rankUp={{
        ...rankUp,
        rank: 'Knight I',
        key: 'knight-1',
        stars: 60,
        nextRank: 'Knight II',
        nextPost: 15,
      }}
      today="2026-10-14"
      primary={{ label: 'Done', onPress: () => {} }}
    />
  ),
};
/** The watch's end: the lantern brightens per held move, the raids turned
 * back land over the gate, then Results and the streak. */
export const WatchEnd: Story = { args: { held: 4, streak } };
/** The watch's end at a narrow width, with many moves held. */
export const WatchEndNarrow: Story = {
  args: { held: 9 },
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 640 }}>
        <Story />
      </View>
    ),
  ],
};
export const LongTermMemory: Story = {
  render: () => (
    <MemoryBeat count={3} primary={{ label: 'Done', onPress: () => {} }} />
  ),
};
export const Narrow: Story = {
  args: { streak },
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 640 }}>
        <Story />
      </View>
    ),
  ],
};

const portcullis = postMoment(
  { ...firstNights, wards: sampleWards(6, [36, 0]) },
  { ...firstNights, wards: sampleWards(7) },
  '2026-10-20',
);
/** The ward path: the Portcullis held, Squire II, through to the Middle Ward. */
export const PostHeld: Story = {
  render: () =>
    portcullis ? (
      <PostBeat
        posts={portcullis}
        showRank
        primary={{ label: 'Done', onPress: () => {} }}
      />
    ) : (
      <View />
    ),
};
