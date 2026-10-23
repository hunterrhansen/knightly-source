import type { Meta, StoryObj } from '@storybook/react-native';
import { ScrollView, Text, View } from 'react-native';
import { WatchHero } from './watch-hero';

const meta = {
  title: 'Today/Watch hero',
  component: WatchHero,
  decorators: [
    (Story) => (
      <ScrollView
        style={{ height: 820, width: '100%' }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <Story />
      </ScrollView>
    ),
  ],
} satisfies Meta<typeof WatchHero>;
export default meta;
type Story = StoryObj<typeof meta>;

const label = { color: '#f2f1ec', fontSize: 14, fontWeight: '700' } as const;

/** The ward path's posts: each landmark rising behind the wall, as the node
 * cards show it (docs/specs/2026-10-20-ward-path-design.md, "Place art"). */
export const PostLandmarks: Story = {
  args: { wall: 'before', night: 5 },
  render: () => (
    <View style={{ gap: 16 }}>
      {[
        ['board-vision', '1 · The Gatehouse'],
        ['mate-in-one', '2 · The Drawbridge'],
        ['loose-pieces', '3 · The Armoury'],
        ['double-attack', '4 · The Lists'],
        ['mate-in-two', '5 · The Turret Stair'],
        ['the-pin', '6 · The Portcullis'],
        ['remove-the-defender', '7 · The Guardroom (Middle Ward)'],
        ['discovered-attack', '8 · The Postern'],
        ['defending-mate', '9 · The Watchtower'],
        ['in-between', '10 · The Barbican'],
        ['pawn-endings', '11 · The Smithy'],
        ['double-check', '12 · The Gate Towers'],
        ['pinned-pieces', '13 · The Stocks (Inner Ward)'],
        ['x-ray', '14 · The Kitchens'],
        ['square-of-the-pawn', '15 · The Courtyard'],
        ['mating-patterns', '16 · The Chapel'],
        ['trapping', '17 · The Mews'],
        ['luring', '18 · The Great Hall'],
        ['keep', 'The Keep'],
      ].map(([post, name]) => (
        <View key={post} style={{ gap: 6 }}>
          <Text style={label}>{name}</Text>
          <WatchHero wall="before" night={5} post={post} />
        </View>
      ))}
    </View>
  ),
};
