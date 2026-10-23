import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { climbing, firstNights, noNights, scheduled } from './journey-samples';
import { StreakPopover } from './streak-popover';
import { sampleStreak, todaySamples } from './today-samples';
import { TodayScreen } from './today-screen';
import { atTheLists, sampleWards } from './ward-samples';

const meta = {
  title: 'Today/Path home',
  component: TodayScreen,
  decorators: [
    (Story) => (
      <View style={{ height: 820, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof TodayScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
const actions = { open: () => {}, connectGames: () => {}, retry: () => {} };
const story = (
  name: keyof typeof todaySamples,
  journey = firstNights,
): Story => ({
  args: {
    state: todaySamples[name],
    actions,
    journey,
  },
});

/** A few nights kept, Page, no star yet: tonight lit, tomorrow's count. */
export const Ready = story('Ready');
/** The lesson under way: tonight's node ringed with its progress. */
export const Returning = story('Returning');
export const AtRisk = story('At risk');
/** Tonight kept: green with its moon, the extra watch lit above it. */
export const Done = story('Done');
export const AllDone = story('All done');

/** Tonight kept at the Lists, seen from the path: press to replay the step
 * (tonight pops green, the road fills, the knight walks up and the extra
 * watch lights). */
function KeepTonight() {
  const [kept, setKept] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <TodayScreen
        state={todaySamples[kept ? 'Done' : 'Ready']}
        actions={actions}
        // Keeping a night adds it to the journey, as the server's refetch does.
        journey={
          kept
            ? {
                ...atTheLists,
                nights: {
                  ...atTheLists.nights,
                  total: atTheLists.nights.total + 1,
                },
              }
            : atTheLists
        }
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => setKept(!kept)}
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          padding: 12,
          backgroundColor: '#58cc02',
          borderRadius: 12,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {kept ? 'Reset' : 'Keep tonight'}
        </Text>
      </Pressable>
    </View>
  );
}
export const StepAfterKeeping: Story = {
  ...story('Ready'),
  render: () => <KeepTonight />,
};
export const MilestoneDone = story('Milestone');
/** Weeks in: Squire II, reached castles, stars, Squire III ahead. */
export const Climbing = story('Ready', climbing);
export const ClimbingKept = story('Done', climbing);
/** `/api/journey` not loaded (or failed): tonight and tomorrow, no castles. */
export const WithoutJourney: Story = {
  args: { ...Ready.args, journey: undefined },
} as Story;
/** The ward path: the Lists, one lesson held, the beacon on the next. */
export const OnTheWards = story('Ready', atTheLists);
export const OnTheWardsKept = story('Done', atTheLists);
/** A new learner: the Drawbridge current, the Gatehouse blocked behind. */
export const WardsFirstPost = story('Ready', {
  ...firstNights,
  wards: sampleWards(2),
});
/** Deep in: the Portcullis, with a lesson that has no drills yet. */
export const WardsPortcullis = story('Ready', {
  ...firstNights,
  wards: sampleWards(6, [2, 0]),
});
/** Into the Middle Ward: the Postern current, the ward's gate drawn below
 * the Guardroom, over the Outer Ward's posts. */
export const WardsMiddleWard = story('Ready', {
  ...firstNights,
  wards: sampleWards(8, [1]),
});
/** The whole walk: at the Great Hall, post 18, with every post behind it
 * down to the Gatehouse, the three wards' gates and the rank castles. */
export const WardsWholeWalk = story('Ready', {
  ...scheduled,
  wards: sampleWards(18, [1]).map((w) =>
    w.state === 'current' ? { ...w, entered_on: '2026-10-12' } : w,
  ),
});
export const FirstNight = story('First night', noNights);
export const New = story('New', noNights);
export const Analyzing = story('Analyzing', noNights);
export const Rest = story('Rest');
export const Loading = story('Loading');
export const LoadError = story('Error');
export const StreakPopoverOpen: Story = {
  ...Ready,
  render: (args) => (
    <>
      <TodayScreen {...args} />
      <StreakPopover
        streak={sampleStreak}
        anchor={{ x: 16, y: 54, width: 72, height: 40 }}
        onClose={() => {}}
      />
    </>
  ),
};
export const Unavailable: Story = {
  args: { ...Ready.args, notice: 'That feature is not available yet' },
} as Story;
export const Narrow: Story = {
  ...Climbing,
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 820 }}>
        <Story />
      </View>
    ),
  ],
};
export const Wide: Story = {
  ...Done,
  decorators: [
    (Story) => (
      <View style={{ width: 1000, height: 820 }}>
        <Story />
      </View>
    ),
  ],
};
