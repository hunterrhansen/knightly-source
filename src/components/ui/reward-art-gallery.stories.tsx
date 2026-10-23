import type { Meta, StoryObj } from '@storybook/react-native';
import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { darkTheme } from '../../theme/themes';
import { moonPhaseDays } from '../kit/art/moon-phase-art';
import { ActionIcon, type ActionIconName } from './action-icon';
import { KnightlyGlyph } from './knightly-glyph';
import { MilestoneMedal } from './milestone-medal';
import { MoonPhase } from './moon-phase';
import {
  type RewardArtCandidate,
  type RewardItem,
  rewardArtCandidates,
} from './reward-art-candidates';
import { ShootingStar } from './shooting-star';
import { StarShard } from './star-shard';

// Judging surface for docs/art-style-lock.md: candidates on the page, at
// the sizes they ship at, and as a 24 pt silhouette.
const items: RewardItem[] = ['shard', 'bonus', 'medal', 'chest'];
/** Shipped or planned sizes: counter and flying shard, run bonus, medal, chest. */
const sizes: Record<RewardItem, number[]> = {
  shard: [20, 30, 112],
  bonus: [30, 56, 112],
  medal: [44, 108],
  chest: [64, 128],
};
const SILHOUETTE = 24;
// Knightly is dark only, so there is one page to judge on.
const pages = [{ name: 'Dark', colors: darkTheme.colors }] as const;
type Colors = (typeof pages)[number]['colors'];

/** The art in code today: the locked shard, shooting-star bonus and
 * milestone medal; the chest is not drawn yet. */
function StandIn({ item, size }: { item: RewardItem; size: number }) {
  if (item === 'shard') return <StarShard size={size} />;
  if (item === 'bonus') return <ShootingStar size={size} />;
  if (item === 'medal') return <MilestoneMedal size={size} />;
  return <Empty size={size} />;
}

function Empty({ size }: { size: number }) {
  return (
    <View
      style={[styles.empty, { width: size, height: size, borderRadius: 8 }]}
    />
  );
}

function Art({
  candidate,
  size,
  tint,
}: {
  candidate: RewardArtCandidate;
  size: number;
  tint?: string;
}) {
  return (
    <Image
      source={candidate.source}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, tintColor: tint }}
    />
  );
}

function Page({
  colors,
  label,
  children,
}: {
  colors: Colors;
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <Text style={[styles.label, { color: colors.inkMuted }]}>{label}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

/** The 18 pt counter pill, where a star shard has to read at its smallest. */
function CounterPill({
  colors,
  children,
}: {
  colors: Colors;
  children: ReactNode;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: colors.surface }]}>
      {children}
      <Text style={[styles.pillText, { color: colors.goldText }]}>1,240</Text>
    </View>
  );
}

const directions = () =>
  [...new Set(rewardArtCandidates.map((c) => c.direction))].sort();
const firstOf = (direction: string, item: RewardItem) =>
  rewardArtCandidates.find((c) => c.direction === direction && c.item === item);

function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

const emptyNote =
  'No AI candidates yet: add PNGs to assets/reward-art/candidates/ and register them in reward-art-candidates.ts (see docs/art-style-lock.md).';

/** Every direction's kit side by side, so the set reads as one game. */
function StyleLock({ size }: { size: number }) {
  const rows: { label: string; render: (item: RewardItem) => ReactNode }[] = [
    {
      label: 'In code',
      render: (item) => <StandIn item={item} size={size} />,
    },
    ...directions().map((direction) => ({
      label: `Direction ${direction}`,
      render: (item: RewardItem) => {
        const candidate = firstOf(direction, item);
        return candidate ? (
          <Art candidate={candidate} size={size} />
        ) : (
          <Empty size={size} />
        );
      },
    })),
  ];
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {rewardArtCandidates.length === 0 && <Note>{emptyNote}</Note>}
      <View style={styles.columns}>
        {pages.map(({ name, colors }) => (
          <View key={name} style={styles.column}>
            {rows.map((row) => (
              <Page
                key={row.label}
                colors={colors}
                label={`${row.label} · ${name}`}
              >
                {items.map((item) => (
                  <View key={item} style={styles.cell}>
                    {row.render(item)}
                    <Text style={[styles.caption, { color: colors.inkMuted }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </Page>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Each candidate at its shipped sizes on the page, plus its silhouette. */
function Sizes() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.columns}>
        {pages.map(({ name, colors }) => (
          <View key={name} style={styles.column}>
            <Page colors={colors} label={`Star shard (locked) · ${name}`}>
              {sizes.shard.map((size) => (
                <StarShard key={size} size={size} />
              ))}
              <CounterPill colors={colors}>
                <StarShard size={20} />
              </CounterPill>
            </Page>
          </View>
        ))}
      </View>
      {rewardArtCandidates.length === 0 && <Note>{emptyNote}</Note>}
      {rewardArtCandidates.map((candidate) => (
        <View key={candidate.name} style={styles.columns}>
          {pages.map(({ name, colors }) => (
            <View key={name} style={styles.column}>
              <Page colors={colors} label={`${candidate.name} · ${name}`}>
                {sizes[candidate.item].map((size) => (
                  <Art key={size} candidate={candidate} size={size} />
                ))}
                <Art
                  candidate={candidate}
                  size={SILHOUETTE}
                  tint={colors.ink}
                />
                {candidate.item === 'shard' && (
                  <CounterPill colors={colors}>
                    <Art candidate={candidate} size={18} />
                  </CounterPill>
                )}
              </Page>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const moonDays = Array.from({ length: moonPhaseDays + 1 }, (_, day) => day);

/** The streak moon through its week beside the shard it must match, then at
 * streak pill and calendar sizes. */
function MoonPhases() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {pages.map(({ name, colors }) => (
        <Page
          key={name}
          colors={colors}
          label={`Moon streak, days 0–7 · ${name}`}
        >
          {moonDays.map((day) => (
            <View key={day} style={styles.cell}>
              <MoonPhase day={day} size={52} />
              <Text style={[styles.caption, { color: colors.inkMuted }]}>
                {day}
              </Text>
            </View>
          ))}
          <StarShard size={52} />
          <View style={styles.row}>
            {moonDays.map((day) => (
              <MoonPhase key={day} day={day} size={20} />
            ))}
          </View>
          <View style={styles.row}>
            {moonDays.map((day) => (
              <MoonPhase key={day} day={day} size={16} />
            ))}
          </View>
        </Page>
      ))}
    </ScrollView>
  );
}

const glyphs = ['today', 'games', 'progress', 'settings'] as const;

/** The tab icons beside the shard, at the 28 pt tab size and the web
 * sidebar's 30–32 pt, on the page. */
function TabIcons() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {pages.map(({ name, colors }) => (
        <Page key={name} colors={colors} label={`Tab icons · ${name}`}>
          {glyphs.map((glyph) => (
            <View key={glyph} style={styles.cell}>
              <KnightlyGlyph name={glyph} size={64} />
              <View style={styles.row}>
                <KnightlyGlyph name={glyph} size={32} />
                <KnightlyGlyph name={glyph} size={28} />
              </View>
              <Text style={[styles.caption, { color: colors.inkMuted }]}>
                {glyph}
              </Text>
            </View>
          ))}
          <StarShard size={64} />
        </Page>
      ))}
    </ScrollView>
  );
}

const actionIcons: ActionIconName[] = [
  'check',
  'clock',
  'hint',
  'review',
  'back',
  'next',
  'retry',
  'solution',
  'forward',
  'best',
  'share',
  'list',
  'close',
  'first',
  'last',
  'flip',
  'up',
  'down',
  'board',
];

/** The line icons in the glyphs' cel at their shipped sizes: 24 pt in
 * buttons, 20 pt on stat cards, 18 pt inline; then on filled buttons. */
function ActionIcons() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {pages.map(({ name, colors }) => (
        <Page key={name} colors={colors} label={`Line icons · ${name}`}>
          {actionIcons.map((icon) => (
            <View key={icon} style={styles.cell}>
              <View style={styles.row}>
                <ActionIcon name={icon} color={colors.ink} size={24} />
                <ActionIcon name={icon} color={colors.flame} size={20} />
                <ActionIcon
                  name={icon}
                  color={colors.inkMuted}
                  size={18}
                  strokeWidth={2.6}
                />
              </View>
              <Text style={[styles.caption, { color: colors.inkMuted }]}>
                {icon}
              </Text>
            </View>
          ))}
          <View style={styles.row}>
            {(['brand', 'sky', 'gold'] as const).map((fill) => (
              <View
                key={fill}
                style={[styles.button, { backgroundColor: colors[fill] }]}
              >
                <ActionIcon name="hint" color="#ffffff" />
                <ActionIcon name="retry" color="#ffffff" />
                <ActionIcon name="next" color="#ffffff" />
              </View>
            ))}
            <KnightlyGlyph name="settings" size={32} />
          </View>
        </Page>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  screen: { padding: 16, gap: 16 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  column: { gap: 12, flexGrow: 1, flexBasis: 320 },
  page: { padding: 16, borderRadius: 12, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
  },
  label: { fontSize: 13, fontWeight: '700' },
  cell: { alignItems: 'center', gap: 6 },
  caption: { fontSize: 12 },
  empty: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#9a9a90' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { fontSize: 15, fontWeight: '800' },
  note: { fontSize: 14, color: '#56614e' },
});

const meta = {
  title: 'UI/Reward art gallery',
  component: StyleLock,
  args: { size: 64 },
} satisfies Meta<typeof StyleLock>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Pick one direction: do shard, bonus, medal and chest look like one game? */
export const StyleLockStory: Story = { name: 'Style lock' };
/** Shipped sizes, the 24 pt silhouette and the 18 pt counter pill. */
export const SizesStory: Story = { name: 'Sizes', render: () => <Sizes /> };
/** The moon-phase streak: new on day 0, full on day 7. */
export const MoonPhasesStory: Story = {
  name: 'Moon phases',
  render: () => <MoonPhases />,
};
/** The navigation glyphs in the shard's glossy cel. */
export const TabIconsStory: Story = {
  name: 'Tab icons',
  render: () => <TabIcons />,
};
/** The line icons and settings gear in the glyphs' cel. */
export const LineIconsStory: Story = {
  name: 'Line icons',
  render: () => <ActionIcons />,
};
