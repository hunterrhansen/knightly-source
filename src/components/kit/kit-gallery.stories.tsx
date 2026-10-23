import type { Meta, StoryObj } from '@storybook/react-native';
import { Chess } from 'chess.js';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chessboard } from '../../chess/board';
import { darkTheme } from '../../theme/themes';
import { nightWatch } from './manifest';
import { CaptainHealth, WallViewRaiders } from './raiders';
import {
  KitProvider,
  useCharacter,
  useRaider,
  useScene,
  useWallView,
} from './registry';
import { actorBox, SceneView } from './scene';
import { SpriteView } from './sprite';
import type {
  KnightState,
  Manifest,
  Raid,
  RaiderKind,
  RaidMood,
  Sprite,
  WallHeroState,
} from './types';
import { WallViewFar, WallViewFringe, WallViewNear } from './wall-view';
import { WatchEndScene } from './watch-end';

// The kit gallery (docs/specs/2026-10-18-watch-kit-design.md): every role in
// the current kit, at its smallest and largest shipped sizes, on the page.
// Judge a swapped sprite here before it reaches a screen.

// Knightly is dark only, so there is one page to judge on.
const pages = [{ name: 'Dark', colors: darkTheme.colors }] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}

/** One sprite at its min and max size on the page, labelled by role. */
function SpriteRow({ role, sprite }: { role: string; sprite: Sprite }) {
  return (
    <View style={styles.row}>
      <Text style={styles.role}>
        {role} · {sprite.id}
      </Text>
      <View style={styles.pages}>
        {pages.map((page) => (
          <View
            key={page.name}
            style={[styles.page, { backgroundColor: page.colors.page }]}
          >
            <SpriteView sprite={sprite} size={sprite.sizes.min} />
            <SpriteView sprite={sprite} size={sprite.sizes.max} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Characters() {
  const knight = useCharacter('character.knight');
  return (
    <Section title="Characters">
      {Object.entries(knight.states).map(([state, sprite]) => (
        <SpriteRow
          key={state}
          role={`character.knight:${state}`}
          sprite={sprite}
        />
      ))}
      {(['p', 'n', 'b', 'r', 'q', 'k'] as const).map((kind) => (
        <RaiderRow key={kind} kind={kind} />
      ))}
    </Section>
  );
}

/** A raider in every state, at its smallest and largest size. */
function RaiderRow({ kind }: { kind: RaiderKind }) {
  const raider = useRaider(kind);
  return (
    <View style={styles.row}>
      <Text style={styles.role}>
        character.raider.{kind} · lurk, flinch, knockedOut, flee
      </Text>
      <View style={styles.pages}>
        {pages.map((page) => (
          <View
            key={page.name}
            style={[styles.page, { backgroundColor: page.colors.page }]}
          >
            {Object.entries(raider.states).map(([state, sprite]) => (
              <View key={state} style={styles.sizes}>
                <SpriteView sprite={sprite} size={sprite.sizes.min} />
                <SpriteView sprite={sprite} size={sprite.sizes.max} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The pose the Watch page gives the knight in each state of the wall. */
const poses = {
  before: 'lookout',
  kept: 'dozing',
  firstNight: 'arriving',
  end: 'lookout',
} as const satisfies Record<WallHeroState, KnightState>;

function Scenes() {
  return (
    <Section title="Scenes">
      {(Object.keys(poses) as WallHeroState[]).map((state) => (
        <WallState key={state} state={state} />
      ))}
    </Section>
  );
}

function WallState({ state }: { state: WallHeroState }) {
  const scene = useScene('scene.wallHero', state);
  const knight = useCharacter('character.knight').states[poses[state]];
  return (
    <View style={styles.row}>
      <Text style={styles.role}>
        scene.wallHero:{state} · {scene.id}
      </Text>
      <View style={styles.scene}>
        <SceneView
          scene={scene}
          renderActor={(slot) =>
            slot.id === 'knight' ? (
              <View style={actorBox(slot)}>
                <SpriteView sprite={knight} size={slot.height} />
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}

// A middlegame with every piece type on both square colours.
const sampleFen =
  'r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 7';

const BOARD = 320;

/** The opponent's pieces of `fen` as raiders, as a lesson describes them;
 * `out` names captured pieces by square. Story-only: features build their
 * own from the position. */
function sampleRaid(
  fen: string,
  learner: 'w' | 'b',
  mood: RaidMood,
  out: readonly string[],
  cracked: number,
): Raid {
  const raiders = new Chess(fen)
    .board()
    .flat()
    .flatMap((cell) =>
      cell && cell.color !== learner
        ? [
            {
              id: cell.square,
              kind: cell.type,
              file:
                learner === 'w'
                  ? cell.square.charCodeAt(0) - 97
                  : 104 - cell.square.charCodeAt(0),
              depth:
                learner === 'w'
                  ? 8 - Number(cell.square[1])
                  : Number(cell.square[1]) - 1,
              out: out.includes(cell.square),
            },
          ]
        : [],
    );
  const captain = learner === 'w' ? 'f6' : 'f3';
  return {
    key: `gallery-${learner}`,
    raiders,
    mood,
    captain: { id: captain, name: 'kd_88’s knight', segments: 3, cracked },
  };
}

/** `scene.wallView`: far band with the raiders, the board under the fringe,
 * then the battlements with the knight. The buttons replay each reaction. */
function WallViewSample({ learner }: { learner: 'w' | 'b' }) {
  const view = useWallView('scene.wallView');
  const [mood, setMood] = useState<RaidMood>('lurk');
  const [out, setOut] = useState<string[]>([]);
  const [cracked, setCracked] = useState(0);
  const [round, setRound] = useState(0);
  const raid = sampleRaid(sampleFen, learner, mood, out, cracked);
  const target = learner === 'w' ? 'd5' : 'c3';
  const actions: [string, () => void][] = [
    ['Lurk', () => setMood('lurk')],
    ['Edge in', () => setMood('edgeIn')],
    ['Fall back', () => setMood('fallBack')],
    ['Capture', () => setOut((o) => (o.includes(target) ? o : [...o, target]))],
    ['Hit captain', () => setCracked((c) => Math.min(3, c + 1))],
    [
      'New position',
      () => {
        setMood('lurk');
        setOut([]);
        setCracked(0);
        setRound((r) => r + 1);
      },
    ],
  ];
  return (
    <View style={styles.row}>
      <View style={[styles.wallView, { backgroundColor: view.ground }]}>
        <View style={styles.far}>
          <WallViewFar
            view={view}
            height={72}
            raiders={(height) => (
              <WallViewRaiders
                raid={{ ...raid, key: `${raid.key}:${round}` }}
                height={height}
                board={{ left: 0, width: BOARD }}
              />
            )}
          />
          <View
            style={[
              styles.fringe,
              {
                bottom: -view.fringe.overlap,
                height: view.fringe.sprite.viewBox[1],
              },
            ]}
          >
            <WallViewFringe view={view} />
          </View>
        </View>
        <Chessboard
          position={{ id: `gallery-${learner}`, fen: sampleFen }}
          orientation={learner}
          policy={{ mode: 'read-only' }}
          presentation={{ showDestinations: false, highlights: [], arrows: [] }}
          onAttempt={() => {}}
        />
        <View style={styles.near}>
          <WallViewNear view={view} height={140} />
        </View>
      </View>
      <View style={styles.captain}>
        <Text style={styles.role}>{raid.captain?.name}</Text>
        <CaptainHealth segments={3} cracked={cracked} />
      </View>
      <View style={styles.buttons}>
        {actions.map(([label, onPress]) => (
          <Pressable key={label} onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function WallViews() {
  return (
    <Section title="scene.wallView">
      <View style={styles.pages}>
        {(['w', 'b'] as const).map((learner) => (
          <View key={learner} style={styles.row}>
            <Text style={styles.role}>
              learner {learner === 'w' ? 'White' : 'Black'}
            </Text>
            <WallViewSample learner={learner} />
          </View>
        ))}
      </View>
    </Section>
  );
}

/** The watch's end over the wall (`fx.lanternBrighten`, `fx.turnedBack`,
 * `copy.watchEnd`): one held move and eight, replayable. */
function SessionEnd() {
  const [play, setPlay] = useState(0);
  return (
    <Section title="Session end (fx.lanternBrighten, fx.turnedBack)">
      <Pressable accessibilityRole="button" onPress={() => setPlay(play + 1)}>
        <Text style={styles.role}>Replay</Text>
      </Pressable>
      {[1, 8].map((held) => (
        <View key={`${held}-${play}`} style={styles.row}>
          <Text style={styles.role}>{held} held</Text>
          <View style={styles.scene}>
            <WatchEndScene held={held} />
          </View>
        </View>
      ))}
    </Section>
  );
}

function Gallery({ kit }: { kit: Manifest }) {
  return (
    <KitProvider kit={kit}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Kit: {kit.name}</Text>
        <Section title="Sprites">
          {Object.entries(kit.sprites).map(([role, sprite]) => (
            <SpriteRow key={role} role={role} sprite={sprite} />
          ))}
        </Section>
        <Section title="Moon phases (reward.moon)">
          <View style={styles.pages}>
            {pages.map((page) => (
              <View
                key={page.name}
                style={[styles.page, { backgroundColor: page.colors.page }]}
              >
                {Array.from({ length: 8 }, (_, day) => (
                  <SpriteView
                    // biome-ignore lint/suspicious/noArrayIndexKey: one per day
                    key={day}
                    sprite={kit.families['reward.moon'](day)}
                    size={28}
                  />
                ))}
              </View>
            ))}
          </View>
        </Section>
        <Section title="Ranks (reward.rankEmblem.*, map.castle)">
          {(['page', 'squire', 'knight'] as const).map((tier) =>
            [0, 1, 2, 3].map((level) => (
              <SpriteRow
                key={`${tier}-${level}`}
                role={`reward.rankEmblem.${tier}(${level})`}
                sprite={kit.emblems[`reward.rankEmblem.${tier}`](level)}
              />
            )),
          )}
          {Object.entries(kit.characters['map.castle'].states).map(
            ([state, sprite]) => (
              <SpriteRow
                key={state}
                role={`map.castle:${state}`}
                sprite={sprite}
              />
            ),
          )}
        </Section>
        <Characters />
        <Scenes />
        <SessionEnd />
        <WallViews />
      </ScrollView>
    </KitProvider>
  );
}

const meta = {
  title: 'Kit/Gallery',
  component: Gallery,
  args: { kit: nightWatch },
} satisfies Meta<typeof Gallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NightWatch: Story = {};

// Story-only layout; the art brings its own colours.
const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, backgroundColor: darkTheme.colors.page },
  title: { fontSize: 22, fontWeight: '700', color: darkTheme.colors.ink },
  section: { gap: 12 },
  heading: { fontSize: 17, fontWeight: '700', color: darkTheme.colors.ink },
  row: { gap: 6 },
  role: { fontSize: 13, color: darkTheme.colors.inkMuted },
  pages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  page: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  scene: { maxWidth: 480 },
  wallView: { width: 320, overflow: 'hidden', borderRadius: 12 },
  far: { height: 72, zIndex: 1 },
  fringe: { position: 'absolute', left: 0, right: 0 },
  near: { height: 140 },
  sizes: { alignItems: 'flex-end', flexDirection: 'row', gap: 4 },
  captain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: 320 },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: darkTheme.colors.surfaceMuted,
  },
  buttonText: { fontSize: 13, color: darkTheme.colors.ink },
});
