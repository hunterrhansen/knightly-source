import type { Meta, StoryObj } from '@storybook/react-native';
import { ScrollView } from 'react-native';
import { CardTone } from '../../ui';
import type { MapCastle } from './journey-map';
import { climbing, firstNights, noNights, scheduled } from './journey-samples';
import { NodeCard, type OpenCard } from './node-card';
import { type PathNodeKind, pathModel } from './path-model';
import { sampleTonight, todaySamples } from './today-samples';
import type { TodayState } from './today-state';
import { atTheLists } from './ward-samples';

const meta = {
  title: 'Today/Node card',
  component: NodeCard,
  decorators: [
    (Story) => (
      <ScrollView
        style={{ height: 820, width: '100%' }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {/* As in the node sheet: the sheet is the surface. */}
        <CardTone value="plain">
          <Story />
        </CardTone>
      </ScrollView>
    ),
  ],
} satisfies Meta<typeof NodeCard>;
export default meta;
type Story = StoryObj<typeof meta>;
const actions = { open: () => {}, connectGames: () => {}, retry: () => {} };
const learnMore = { onPress: () => {}, busy: false };
const reminder = {
  enabled: true,
  time: '8:00 PM',
  disabled: false,
  blocked: false,
  onToggle: () => {},
  onOpenSystemSettings: () => {},
};

/** Stands in when a sample has no such node or castle. */
const missing: MapCastle = {
  key: 'missing',
  name: 'Missing sample',
  state: 'later',
  reachedOn: null,
  toGo: 0,
};

/** The card a node of `kind` opens on the path built from the samples. */
function card(
  name: keyof typeof todaySamples,
  kind: PathNodeKind,
  journey = firstNights,
): Story {
  const state: TodayState = todaySamples[name];
  const node = pathModel(state, journey).nodes.find((n) => n.kind === kind);
  const open: OpenCard = node
    ? { kind: 'node', node }
    : { kind: 'castle', castle: missing };
  return {
    args: {
      open,
      state,
      actions,
      tonight: sampleTonight,
      reminder,
      learnMore,
      journey,
    },
  };
}

function castle(name: string): Story {
  const state = todaySamples.Ready;
  const found = pathModel(state, climbing)
    .nodes.flatMap((n) => n.castles)
    .find((c) => c.name === name);
  return {
    args: {
      open: { kind: 'castle', castle: found ?? missing },
      state,
      actions,
    },
  };
}

export const TonightReady = card('Ready', 'tonight');
export const TonightReturning = card('Returning', 'tonight');
/** A newly analysed game's slips lead the watch (the game review folded in). */
export const TonightNewGame = card('New game', 'tonight');
export const TonightAtRisk = card('At risk', 'tonight');
export const TonightKept = card('Done', 'tonight');
export const TonightRest = card('Rest', 'tonight');
export const Tomorrow = card('Ready', 'tomorrow');
export const TomorrowReminderBlocked: Story = {
  args: {
    ...Tomorrow.args,
    reminder: { ...reminder, enabled: false, blocked: true },
  },
} as Story;
export const ExtraWatch = card('Done', 'extra');
export const ExtraLearnMore = card('All done', 'extra');
export const ExtraLearnMoreFailed: Story = {
  args: {
    ...ExtraLearnMore.args,
    learnMore: { ...learnMore, error: 'Check your connection and try again.' },
  },
} as Story;
export const KeptNight = card('Ready', 'kept');
export const KeptNightHeld = card('Ready', 'kept', scheduled);
export const ExtraWatchKept = card('Ready', 'extraKept', scheduled);
export const NightAhead = card('Ready', 'ahead', scheduled);
export const ConnectGames = card('New', 'connect', noNights);
export const FindingMoves = card('Analyzing', 'finding', noNights);
export const FirstWatch = card('First night', 'firstWatch', noNights);
export const CastleReached = castle('Squire II');
export const CastleNext = castle('Squire III');

/** The ward path: tonight at the Lists, with what comes back when. */
export const WardTonight = card('Ready', 'tonight', atTheLists);
/** Kept on the ward path: the extra watch, tomorrow and the nights after. */
export const WardExtra = card('Done', 'extra', atTheLists);
/** A post ahead. */
export const WardPost = card('Ready', 'post', atTheLists);
