import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import {
  Beacon,
  Check,
  Moon,
  moonPhaseForNight,
  SpriteView,
  useCastle,
  useCharacter,
  usePressSquish,
  useScene,
  useSprite,
  useSpriteFamily,
  watchColors,
} from '../../ui';
import type { MapCastle } from './journey-map';
import type { PathModel, PathNode } from './path-model';
import { ArrivePop, KeptPop, RoadFill, STEP, WalkingKnight } from './path-step';
import { TrackGlyph } from './track-glyph';
import { lessonDetail } from './ward-path';

// The home path drawn (docs/specs/2026-10-19-path-home-design.md, "Home: the
// path"): a winding column of nodes over the night sky, newest at the top,
// in its own scroll opened with the current node in the lower middle. Rank
// castles stand beside the path; the knight beside the current node.

// Sized as Duolingo's path: a node about 56 pt across on a 6 pt ledge, the
// current one bigger and ringed, about 96 pt between rows.
const ROW = 96;
const NODE = 56;
const CURRENT = 72;
/** An extra watch kept: a smaller node between the nights. */
const SMALL = 36;
const LATER_ROW = 52;
const EARLIER_ROW = 40;
/** Later ranks drawn as castles; the rest are named in one line. */
const LATER_SHOWN = 2;
/** The current node sits this far down the window when the path opens. */
const CURRENT_AT = 0.62;
/** The side tiles' column (Games, Progress) at the path's left edge: post
 * markers keep out of it. */
const TILE_ROOM = 84;
/** Tonight's tag over its node, as Duolingo's "Start". */
const TAG_WIDTH = 84;
const TAG_HEIGHT = 24;
/** The knight beside the current node. */
const KNIGHT = 56;
/** How far the knight's top stands above the row's middle. */
const KNIGHT_RISE = 38;
/** More stars than this on one night show as a count. */
const STARS_SHOWN = 5;

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const nights = (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}`;

/** A milestone's words on the path; 66 is when a habit forms. */
const milestoneText = (n: number) =>
  n === 66 ? '66 nights · a habit' : nights(n);

const posts = (n: number) => `${n} ${n === 1 ? 'post' : 'posts'}`;

export function castleText(castle: MapCastle) {
  if (castle.state === 'reached')
    return castle.reachedOn
      ? `Reached ${shortDate(castle.reachedOn)}`
      : 'Reached';
  if (castle.key === 'page') return 'Your first watch';
  if (castle.beyond || castle.after === undefined)
    return 'Beyond the posts built';
  if (castle.state === 'later' || castle.toGo === null)
    return `After post ${castle.after}`;
  return `${posts(castle.toGo)} to go`;
}

/** A node's accessible name: what it is, its words, and what stands beside
 * it. */
function nodeLabel(node: PathNode) {
  if (node.kind === 'gate') return `${node.title} begins here`;
  if (node.kind === 'castle' && node.castles[0])
    return `${node.castles[0].name}: ${castleText(node.castles[0])}`;
  if (node.kind === 'locked' && node.post)
    return `${node.title}, at post ${node.post.index}, ${node.post.place}. Ahead`;
  const parts: string[] = [];
  if (node.kind === 'post' && node.post) {
    const p = node.post;
    parts.push(`Post ${p.index}, ${p.place}: ${p.topic}`);
    parts.push(
      p.state === 'cleared'
        ? 'Cleared'
        : p.state === 'blocked'
          ? 'Coming soon'
          : 'Ahead',
    );
    for (const c of node.castles) parts.push(`${c.name}: ${castleText(c)}`);
    return parts.join('. ');
  }
  if (node.lesson && node.state === 'current') {
    if (node.kind === 'tonight') parts.push('Tonight’s watch');
    if (node.kind === 'extra') parts.push('Extra watch');
    parts.push(`${node.lesson.name}, ${node.lesson.track}`);
    if (node.kind === 'tonight' && node.detail) parts.push(node.detail);
    if (node.lesson.teachable && !node.lesson.held)
      parts.push(lessonDetail(node.lesson));
    for (const c of node.castles) parts.push(`${c.name}: ${castleText(c)}`);
    return parts.join('. ');
  }
  if (node.kind === 'kept') parts.push(`Night ${node.night}, kept`);
  else if (node.kind === 'extraKept') parts.push('Extra watch, kept');
  else if (node.kind === 'ahead')
    parts.push(node.title || `Night ${node.night}, ahead`);
  else if (node.kind === 'tonight' && node.state === 'done')
    parts.push(`Tonight, night ${node.night}, kept`);
  else if (node.kind === 'tonight') parts.push(`Tonight, night ${node.night}`);
  else parts.push(node.title);
  if (node.kind === 'tonight' && node.state !== 'done') parts.push(node.title);
  if (node.kind === 'tomorrow') parts[0] = node.title;
  if (node.detail) parts.push(node.detail);
  if (
    node.state === 'done' &&
    node.kind !== 'kept' &&
    node.kind !== 'tonight' &&
    node.kind !== 'extraKept'
  )
    parts.push('Done');
  if (node.milestone) parts.push(`${milestoneText(node.milestone)} milestone`);
  const lit = node.stars.filter((s) => !s.dimmed).length;
  const dim = node.stars.length - lit;
  if (lit) parts.push(`${lit} ${lit === 1 ? 'star' : 'stars'} earned`);
  if (dim)
    parts.push(
      `${dim} ${dim === 1 ? 'star' : 'stars'} dimmed, back on your watch`,
    );
  return parts.join('. ');
}

/** A node that opens: the whole row is its hit target, and pressing anywhere
 * on it squashes the node itself, like every other control. */
function PressableNode({
  label,
  selected,
  onPress,
  faceAt,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  faceAt: { left: number; top: number };
  children: ReactNode;
}) {
  const styles = useStyles();
  const squish = usePressSquish();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={squish.onPressIn}
        onPressOut={squish.onPressOut}
        style={styles.hit}
      />
      <Animated.View style={[styles.face, faceAt, squish.style]}>
        {children}
      </Animated.View>
    </>
  );
}

function Castle({
  castle,
  onPress,
}: {
  castle: MapCastle;
  onPress: (castle: MapCastle) => void;
}) {
  const styles = useStyles();
  const sprite = useCastle(castle.state === 'reached' ? 'reached' : 'ahead');
  const squish = usePressSquish({ squash: tokens.motion.squash.surface });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${castle.name}: ${castleText(castle)}`}
      onPress={() => onPress(castle)}
      onPressIn={squish.onPressIn}
      onPressOut={squish.onPressOut}
      hitSlop={4}
    >
      <Animated.View
        style={[
          styles.castle,
          castle.state === 'later' && styles.faint,
          squish.style,
        ]}
      >
        <SpriteView sprite={sprite} size={40} />
        <View style={styles.castleText}>
          <Text style={styles.castleName} numberOfLines={1}>
            {castle.name}
          </Text>
          <Text
            style={[
              styles.castleMeta,
              castle.state === 'reached' && styles.reachedMeta,
            ]}
            numberOfLines={1}
          >
            {castleText(castle)}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** A rank castle standing on the road, as Duolingo's chests do. */
function CastleFace({ castle }: { castle: MapCastle }) {
  const styles = useStyles();
  const sprite = useCastle(castle.state === 'reached' ? 'reached' : 'ahead');
  return (
    <View style={castle.state === 'later' && styles.faint}>
      <SpriteView sprite={sprite} size={NODE} />
    </View>
  );
}

function Stars({ node }: { node: PathNode }) {
  const styles = useStyles();
  const shard = useSprite('reward.starShard');
  if (!node.stars.length) return null;
  return (
    <View style={styles.stars}>
      {node.stars.slice(0, STARS_SHOWN).map((star) => (
        <View
          key={`${star.game_id}-${star.ply}`}
          style={star.dimmed && styles.dimmedStar}
        >
          <SpriteView sprite={shard} size={18} />
        </View>
      ))}
      {node.stars.length > STARS_SHOWN && (
        <Text style={styles.more}>{`+${node.stars.length - STARS_SHOWN}`}</Text>
      )}
    </View>
  );
}

/** A kept night's face: that night's moon, or the medal on a milestone. */
function KeptFace({ node, size }: { node: PathNode; size: number }) {
  const moon = useSpriteFamily(
    'reward.moon',
    moonPhaseForNight(node.night ?? 0),
  );
  const medal = useSprite('reward.medal');
  return <SpriteView sprite={node.milestone ? medal : moon} size={size} />;
}

const RING_STROKE = 5;
/** Tonight's lesson under way, or a lesson's puzzles solved toward holding
 * it, as a ring around its node. */
function ProgressRing({
  done,
  total,
  around = CURRENT,
}: {
  done: number;
  total: number;
  around?: number;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const size = around + 14;
  const r = (size - RING_STROKE) / 2;
  const length = 2 * Math.PI * r;
  const share = total ? Math.min(1, done / total) : 0;
  return (
    <View
      style={[
        styles.ring,
        around === CURRENT ? { left: -10, top: -9 } : { left: -7, top: -7 },
      ]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={watchColors.ringTrack}
          strokeWidth={RING_STROKE}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.colors.brand}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${share * length} ${length}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

function Node({ node }: { node: PathNode }) {
  const styles = useStyles();
  const { theme } = useTheme();
  const current = node.state === 'current';
  if (node.kind === 'castle' && node.castles[0])
    return <CastleFace castle={node.castles[0]} />;
  if (node.kind === 'locked' && node.lesson)
    // A lesson of a post ahead: grey, its track's glyph; dashed when its
    // drills aren't built.
    return (
      <View
        style={[
          styles.node,
          styles.later,
          !node.lesson.teachable && styles.comingSoon,
        ]}
      >
        <TrackGlyph
          track={node.lesson.track}
          size={26}
          color={theme.colors.inkMuted}
        />
      </View>
    );
  if (node.kind === 'extraKept')
    // Smaller than a night: kept, between the nights.
    return (
      <View style={[styles.node, styles.done, styles.small]}>
        <Check size={18} color={theme.colors.onBrand} />
      </View>
    );
  if (node.kind === 'extra')
    // Lit softly: a glow and no beacon, so tonight stays the night's one call.
    return (
      <View style={styles.extraGlow}>
        <View style={[styles.node, styles.extra]}>
          {node.lesson ? (
            <TrackGlyph
              track={node.lesson.track}
              size={28}
              color={theme.colors.onBrand}
            />
          ) : (
            <Moon size={28} filled={false} color={theme.colors.onBrand} />
          )}
        </View>
      </View>
    );
  if (current)
    return (
      <View style={[styles.node, styles.current]}>
        <Beacon color={theme.colors.brand} />
        {node.progress && <ProgressRing {...node.progress} />}
        {node.lesson ? (
          <TrackGlyph
            track={node.lesson.track}
            size={34}
            color={theme.colors.ink}
          />
        ) : node.kind === 'tonight' || node.kind === 'firstWatch' ? (
          <Moon size={32} filled={false} color={theme.colors.ink} />
        ) : (
          <Text style={styles.currentText}>
            {node.kind === 'connect' ? '1' : '2'}
          </Text>
        )}
      </View>
    );
  if (node.state === 'done')
    return (
      <View style={[styles.node, styles.done]}>
        {node.kind === 'kept' || node.kind === 'tonight' ? (
          <KeptFace node={node} size={38} />
        ) : (
          <Check size={26} color={theme.colors.onBrand} />
        )}
      </View>
    );
  return (
    <View
      style={[
        styles.node,
        styles.later,
        // Beyond the schedule the server serves, the nights are faint.
        node.kind === 'ahead' && !node.ahead && styles.faintNode,
      ]}
    >
      <Moon size={26} filled={false} color={theme.colors.inkMuted} />
    </View>
  );
}

/** A post on the ward path: not a node on the wave but a marker across the
 * road, like a section header, so where one post ends and the next begins is
 * plain. Cleared posts carry a check, blocked ones are dashed; a castle that
 * stands with this post sits beside it, never over a lesson's words. */
function PostMarker({
  node,
  onPress,
  onCastle,
}: {
  node: PathNode;
  onPress: () => void;
  onCastle: (castle: MapCastle) => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const squish = usePressSquish({ squash: tokens.motion.squash.surface });
  const post = node.post;
  if (!post) return null;
  const cleared = post.state === 'cleared';
  const blocked = post.state === 'blocked';
  return (
    <View style={styles.postLine}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nodeLabel({ ...node, castles: [] })}
        onPress={onPress}
        onPressIn={squish.onPressIn}
        onPressOut={squish.onPressOut}
        style={styles.postHit}
      >
        <Animated.View
          style={[
            styles.post,
            cleared && styles.postCleared,
            blocked && styles.postBlocked,
            squish.style,
          ]}
        >
          <View
            style={[
              styles.postMark,
              cleared ? styles.postMarkCleared : styles.postMarkAhead,
              blocked && styles.comingSoon,
            ]}
          >
            {cleared ? (
              <Check size={14} color={theme.colors.onBrand} />
            ) : (
              <TrackGlyph
                track={post.lessons[0]?.track ?? 'tactic'}
                size={14}
                color={theme.colors.inkMuted}
              />
            )}
          </View>
          <View style={styles.postText}>
            <Text
              style={[styles.postPlace, !cleared && styles.titleLater]}
              numberOfLines={1}
            >
              {`${post.index} · ${post.place}`}
            </Text>
            {!!node.detail && (
              <Text style={styles.detail} numberOfLines={1}>
                {node.detail}
              </Text>
            )}
          </View>
        </Animated.View>
      </Pressable>
      {node.castles.map((castle) => (
        <Castle key={castle.key} castle={castle} onPress={onCastle} />
      ))}
    </View>
  );
}

/** The path's x for a row: a slow wave about the middle. */
const waveX = (row: number, width: number) =>
  width / 2 + Math.min(56, width * 0.15) * Math.sin(row * 0.85);

/** A smooth line through the points, bending at each midpoint. */
function smooth(points: readonly (readonly [number, number])[]) {
  const [first, ...rest] = points;
  if (!first) return '';
  let d = `M${first[0]} ${first[1]}`;
  let prev = first;
  for (const p of rest) {
    const midY = (prev[1] + p[1]) / 2;
    d += ` C${prev[0]} ${midY} ${p[0]} ${midY} ${p[0]} ${p[1]}`;
    prev = p;
  }
  return d;
}

/** Whether a node opens a card: everything but the nights ahead whose
 * schedule the server does not serve (an older server). */
const opens = (node: PathNode) =>
  node.kind !== 'gate' && (node.kind !== 'ahead' || !!node.ahead);

/** A step along the path: `from` was the current node and is now kept. It
 * waits until the path is on screen (`playing`), then runs once. */
type Step = { from: string; to: string; playing: boolean };

/** About the length of `smooth` through the points: chords plus the bends. */
function roughLength(points: readonly (readonly [number, number])[]) {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    if (a && b) sum += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return sum * 1.25;
}

/** The night sky behind the path, drawn the same wherever it shows. */
function Sky({ width, height }: { width: number; height: number }) {
  const styles = useStyles();
  const sky = useScene('scene.wallHero', 'before').sky;
  const id = useId().replace(/:/g, '');
  return (
    <View
      style={styles.art}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky[0]} />
            <Stop offset="1" stopColor={sky[1]} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** The path, opened on the current node. */
export function PathView({
  model,
  onNode,
  onCastle,
  insetTop = 0,
  coverTop = 0,
  focused = true,
}: {
  model: PathModel;
  /** Whether the path is on screen: a step taken while a watch was open
   * waits for the return to it. */
  focused?: boolean;
  /** Room at the top for what floats over the path (the section banner),
   * beyond the header the platform already insets. */
  insetTop?: number;
  /** Above this line the road is hidden behind the sky (the section banner's
   * top), so what scrolls under the banner never shows above it. */
  coverTop?: number;
  onNode: (node: PathNode) => void;
  onCastle: (castle: MapCastle) => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const knight = useCharacter('character.knight').states.lookout;
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const scroll = useRef<ScrollView>(null);
  const opened = useRef<string | null>(null);
  const reduced = useSystemReducedMotion();
  const { width } = frame;
  // On a wide window the wave keeps to one centred column; words stay in it.
  const column = Math.min(width, theme.layout.pathMax);
  const gutter = (width - column) / 2;
  const laterCastles = model.later.slice(0, LATER_SHOWN);
  const laterNamed = model.later.slice(LATER_SHOWN).map((c) => c.name);
  const laterHeight =
    (laterCastles.length + (laterNamed.length ? 1 : 0)) * LATER_ROW;
  const currentIndex = model.nodes.findIndex((n) => n.state === 'current');
  const yOf = (index: number) => laterHeight + index * ROW + ROW / 2;
  const content =
    laterHeight + model.nodes.length * ROW + (model.earlier ? EARLIER_ROW : 0);
  // Short paths sit at the bottom of the window, as the road starts there.
  const height = Math.max(content, frame.height);
  const offset = height - content;
  // Each node keeps its place on the wave counted from the path's start, so
  // the path doesn't reshuffle as nights are added above.
  // A post marker sits in the middle of the column; the road runs through it.
  const points = model.nodes.map(
    (node, i) =>
      [
        node.kind === 'post' || node.kind === 'gate'
          ? gutter + column / 2
          : gutter + waveX(model.nodes.length - i, column),
        offset + yOf(i),
      ] as const,
  );
  const split = currentIndex < 0 ? 0 : currentIndex;
  const ahead = points.slice(0, split + 1);
  // The walked road runs down through the nodes behind until one that was
  // never done (a blocked post): from there it is dashed, never claimed.
  const notDone = model.nodes.findIndex(
    (n, i) => i > split && n.state !== 'done',
  );
  const walkedTo = notDone < 0 ? points.length : notDone;
  const behind = points.slice(split, walkedTo);
  const unwalked = notDone < 0 ? [] : points.slice(notDone - 1);
  const currentY = offset + yOf(split);
  const currentKey = model.nodes[split]?.key ?? null;
  // A watch kept moves the current node on: the step is noticed as the model
  // changes (before anything is drawn), played once the path is on screen.
  const [seen, setSeen] = useState({ key: currentKey, nodes: model.nodes });
  const [step, setStep] = useState<Step | null>(null);
  if (seen.key !== currentKey) {
    setSeen({ key: currentKey, nodes: model.nodes });
    // From the node kept just now: one that was on the path and not done
    // (the journey loading after the first draw changes keys, never this).
    const before = new Map(seen.nodes.map((n) => [n.key, n.state]));
    const kept = model.nodes.find(
      (n, i) =>
        i > split &&
        n.kind !== 'gate' &&
        n.state === 'done' &&
        before.has(n.key) &&
        before.get(n.key) !== 'done',
    );
    setStep(
      seen.key && currentKey && kept && !reduced
        ? { from: kept.key, to: currentKey, playing: false }
        : null,
    );
  }
  const fromIndex = step
    ? model.nodes.findIndex((n) => n.key === step.from)
    : -1;
  const stepping = step && fromIndex > split ? step : null;
  // Where the walk scrolls to, read when it scrolls: a banner note appearing
  // mid-step moves it without restarting the step.
  const walkTo = useRef(0);
  walkTo.current = Math.max(0, insetTop + currentY - frame.height * CURRENT_AT);
  useEffect(() => {
    if (!stepping || !focused || !width) return;
    if (!stepping.playing) {
      setStep({ ...stepping, playing: true });
      return;
    }
    const walk = setTimeout(
      () => scroll.current?.scrollTo({ y: walkTo.current, animated: true }),
      STEP.walk,
    );
    const end = setTimeout(() => setStep(null), STEP.end);
    return () => {
      clearTimeout(walk);
      clearTimeout(end);
    };
  }, [stepping, focused, width]);
  // Open on the current node once the path is drawn, and again when the
  // current node changes (tonight kept: the extra watch lights).
  // The floating banner's room shifts the road down, so it counts too.
  const openOn = `${currentKey}@${insetTop}`;
  // A step waiting to play opens on the node just kept, so the walk is seen.
  const openY = stepping ? offset + yOf(fromIndex) : currentY;
  useEffect(() => {
    if (!width || !frame.height || opened.current === openOn) return;
    opened.current = openOn;
    const open = () =>
      scroll.current?.scrollTo({
        y: Math.max(0, insetTop + openY - frame.height * CURRENT_AT),
        animated: false,
      });
    // Now, and again on the next frame once the content has its height (a
    // long path may not have laid out yet; a hidden page runs no frames).
    open();
    const raf = requestAnimationFrame(open);
    return () => cancelAnimationFrame(raf);
  }, [width, frame.height, openY, insetTop, openOn]);
  // Where the knight stands beside a node (the side away from its words).
  const knightWidth = (knight.viewBox[0] / knight.viewBox[1]) * KNIGHT;
  const knightAt = (index: number, size: number) => {
    const [x, y] = points[index] ?? [0, 0];
    return {
      left: x < width / 2 ? x - size / 2 - 2 - knightWidth : x + size / 2 + 2,
      top: y - KNIGHT_RISE,
    };
  };
  // While stepping, the road walked so far stops at the node just kept; the
  // rest fills in as the knight walks it.
  const walked = stepping ? points.slice(fromIndex, walkedTo) : behind;
  const newRoad = stepping ? points.slice(split, fromIndex + 1).reverse() : [];
  return (
    <View style={styles.frame}>
      {/* The sky stays still behind the whole screen; the road scrolls over
          it, under the floating header, banner and side tiles. */}
      {frame.width > 0 && <Sky {...frame} />}
      <ScrollView
        ref={scroll}
        testID="home-path"
        style={styles.window}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insetTop }}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : 'never'
        }
        onLayout={(event) =>
          setFrame({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
      >
        <View style={{ height }}>
          {width > 0 && (
            <>
              <View
                style={styles.art}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Svg width={width} height={height}>
                  <Path
                    d={smooth(ahead)}
                    stroke={theme.colors.line}
                    strokeWidth={6}
                    strokeDasharray="2 12"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {unwalked.length > 1 && (
                    <Path
                      d={smooth(unwalked)}
                      stroke={theme.colors.line}
                      strokeWidth={6}
                      strokeDasharray="2 12"
                      strokeLinecap="round"
                      fill="none"
                    />
                  )}
                  <Path
                    d={smooth(walked)}
                    stroke={theme.colors.brandLedge}
                    strokeWidth={8}
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              </View>
              {stepping && (
                <RoadFill
                  playing={stepping.playing}
                  d={smooth(newRoad)}
                  length={roughLength(newRoad)}
                  width={width}
                  height={height}
                />
              )}
              {laterNamed.length > 0 && (
                <Text
                  style={[
                    styles.laterNamed,
                    { top: offset, height: LATER_ROW },
                  ]}
                >{`Then ${laterNamed.join(', ')}`}</Text>
              )}
              {laterCastles.map((castle, i) => (
                <View
                  key={castle.key}
                  style={[
                    styles.laterRow,
                    {
                      top:
                        offset + (i + (laterNamed.length ? 1 : 0)) * LATER_ROW,
                      height: LATER_ROW,
                    },
                  ]}
                >
                  <Castle castle={castle} onPress={onCastle} />
                </View>
              ))}
              {model.nodes.map((node, i) => {
                const [x, y] = points[i] ?? [0, 0];
                if (node.kind === 'gate')
                  return (
                    <View
                      key={node.key}
                      accessible
                      accessibilityLabel={nodeLabel(node)}
                      style={[
                        styles.row,
                        styles.gateRow,
                        { top: y - ROW / 2, paddingHorizontal: gutter + 16 },
                      ]}
                    >
                      <View style={styles.gateLine} />
                      <Text style={styles.gateText}>
                        {node.title.toUpperCase()}
                      </Text>
                      <View style={styles.gateLine} />
                    </View>
                  );
                if (node.kind === 'post')
                  return (
                    <View
                      key={node.key}
                      style={[
                        styles.row,
                        styles.postRow,
                        {
                          top: y - ROW / 2,
                          // Clear of the side tiles floating at the left.
                          paddingLeft: gutter + TILE_ROOM,
                          paddingRight: gutter + 8,
                        },
                      ]}
                    >
                      <PostMarker
                        node={node}
                        onPress={() => onNode(node)}
                        onCastle={onCastle}
                      />
                    </View>
                  );
                const size =
                  node.state === 'current' && node.kind !== 'extra'
                    ? CURRENT
                    : node.kind === 'extraKept'
                      ? SMALL
                      : NODE;
                // Words go on the roomier side of the path.
                const right = x < width / 2;
                const side = right
                  ? { left: x + size / 2 + 12, right: gutter + 8 }
                  : { right: width - x + size / 2 + 12, left: gutter + 8 };
                const faceAt = { left: x - size / 2, top: ROW / 2 - size / 2 };
                const faceContent = (
                  <>
                    {stepping?.from === node.key ? (
                      <KeptPop playing={stepping.playing} size={size}>
                        <Node node={node} />
                      </KeptPop>
                    ) : stepping?.to === node.key ? (
                      <ArrivePop playing={stepping.playing}>
                        <Node node={node} />
                      </ArrivePop>
                    ) : (
                      <Node node={node} />
                    )}
                  </>
                );
                return (
                  <View
                    key={node.key}
                    style={[styles.row, { top: y - ROW / 2 }]}
                  >
                    {opens(node) ? (
                      <PressableNode
                        label={nodeLabel(node)}
                        selected={node.state === 'current'}
                        onPress={() =>
                          node.kind === 'castle' && node.castles[0]
                            ? onCastle(node.castles[0])
                            : onNode(node)
                        }
                        faceAt={faceAt}
                      >
                        {faceContent}
                      </PressableNode>
                    ) : (
                      <>
                        <View
                          accessible
                          accessibilityLabel={nodeLabel(node)}
                          style={styles.hit}
                        />
                        <View style={[styles.face, faceAt]}>{faceContent}</View>
                      </>
                    )}
                    {node.kind === 'tonight' && node.state === 'current' && (
                      <View
                        style={[
                          styles.tag,
                          {
                            left: x - TAG_WIDTH / 2,
                            top: ROW / 2 - size / 2 - TAG_HEIGHT - 2,
                          },
                        ]}
                      >
                        <Text style={styles.tagText}>TONIGHT</Text>
                      </View>
                    )}
                    {node.state === 'current' && !stepping && (
                      <View
                        style={[
                          styles.knight,
                          right
                            ? { right: width - x + size / 2 + 2 }
                            : { left: x + size / 2 + 2 },
                        ]}
                      >
                        <SpriteView sprite={knight} size={KNIGHT} />
                      </View>
                    )}
                    <View style={[styles.side, side, !right && styles.sideEnd]}>
                      <View style={[styles.words, !right && styles.sideEnd]}>
                        {!!node.title && (
                          <Text
                            style={[
                              styles.title,
                              node.state === 'current' && styles.titleCurrent,
                              node.state === 'later' && styles.titleLater,
                              !right && styles.textEnd,
                            ]}
                            numberOfLines={2}
                          >
                            {node.title}
                          </Text>
                        )}
                        {node.kind === 'castle' && node.castles[0] ? (
                          <Text
                            style={[
                              styles.detail,
                              node.castles[0].state === 'reached' &&
                                styles.reachedMeta,
                              !right && styles.textEnd,
                            ]}
                            numberOfLines={1}
                          >
                            {castleText(node.castles[0])}
                          </Text>
                        ) : (
                          !!node.detail &&
                          node.state !== 'done' && (
                            <Text
                              style={[styles.detail, !right && styles.textEnd]}
                              numberOfLines={2}
                            >
                              {node.detail}
                            </Text>
                          )
                        )}
                      </View>
                      {node.kind !== 'castle' &&
                        node.castles.map((castle) => (
                          <Castle
                            key={castle.key}
                            castle={castle}
                            onPress={onCastle}
                          />
                        ))}
                      <View style={[styles.words, !right && styles.sideEnd]}>
                        {node.milestone ? (
                          <Text style={styles.milestone}>
                            {milestoneText(node.milestone)}
                          </Text>
                        ) : null}
                        <Stars node={node} />
                      </View>
                    </View>
                  </View>
                );
              })}
              {stepping && (
                <WalkingKnight
                  playing={stepping.playing}
                  sprite={knight}
                  size={KNIGHT}
                  from={knightAt(fromIndex, CURRENT)}
                  to={knightAt(
                    split,
                    model.nodes[split]?.kind === 'extra' ? NODE : CURRENT,
                  )}
                />
              )}
              {model.earlier > 0 && (
                <Text
                  style={[styles.earlier, { top: height - EARLIER_ROW }]}
                >{`${nights(model.earlier)} kept before these`}</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
      {frame.width > 0 && coverTop > 0 && (
        <View style={[styles.cover, { height: coverTop }]}>
          <Sky {...frame} />
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  frame: { flex: 1, overflow: 'hidden' },
  window: { flex: 1 },
  art: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
  // Covers the road above the banner; it takes the touches there too.
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  row: { position: 'absolute', left: 0, right: 0, height: ROW },
  // The whole row opens the node; castles above it open their own card.
  hit: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    right: 0,
    borderRadius: 16,
  },
  laterRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 6,
  },
  done: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brandLedge,
  },
  later: {
    backgroundColor: theme.colors.line,
    borderColor: theme.colors.page,
  },
  faintNode: { opacity: 0.55 },
  small: {
    width: SMALL,
    height: SMALL,
    borderRadius: SMALL / 2,
    borderBottomWidth: 4,
  },
  current: {
    width: CURRENT,
    height: CURRENT,
    borderRadius: CURRENT / 2,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: theme.colors.brand,
    backgroundColor: theme.colors.page,
  },
  currentText: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 26,
  },
  extraGlow: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    boxShadow: `0 0 18px 6px ${theme.colors.brand}66`,
  },
  extra: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brandLedge,
    opacity: 0.9,
  },
  ring: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  postRow: { alignItems: 'center', justifyContent: 'center' },
  // A ward's gate: a rule across the column with the ward's name in it; the
  // name's backing hides the road behind it.
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  gateLine: { flex: 1, height: 2, backgroundColor: theme.colors.line },
  gateText: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 13,
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.colors.page,
  },
  tag: {
    position: 'absolute',
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
    borderBottomWidth: 3,
    borderColor: theme.colors.inkMuted,
    pointerEvents: 'none',
  },
  tagText: {
    color: theme.colors.page,
    fontFamily: theme.typography.bold,
    fontSize: 12,
    letterSpacing: 1,
  },
  postLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    maxWidth: '100%',
  },
  postHit: { flexShrink: 1 },
  post: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexShrink: 1,
    minHeight: 48,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.page,
  },
  postCleared: { borderColor: theme.colors.brandLedge },
  postBlocked: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  postMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postMarkCleared: { backgroundColor: theme.colors.brand },
  postMarkAhead: { backgroundColor: theme.colors.line },
  postText: { flexShrink: 1 },
  postPlace: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  // A lesson with no drills yet, or a post none of whose lessons has any:
  // dashed, never mistaken for "not yet".
  comingSoon: {
    borderWidth: 2,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.inkMuted,
    backgroundColor: 'transparent',
    opacity: 0.8,
  },
  knight: {
    position: 'absolute',
    top: ROW / 2 - KNIGHT_RISE,
    pointerEvents: 'none',
  },
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 2,
    // Touches on the words fall through to the row; castles take their own.
    pointerEvents: 'box-none',
  },
  sideEnd: { alignItems: 'flex-end' },
  // Words and the node's face let a tap through to the row beneath them.
  words: { gap: 2, alignItems: 'flex-start', pointerEvents: 'none' },
  face: { position: 'absolute', pointerEvents: 'none' },
  textEnd: { textAlign: 'right' },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  titleCurrent: { fontSize: 17, lineHeight: 22 },
  titleLater: { color: theme.colors.inkMuted },
  detail: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  castle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  castleText: { flexShrink: 1 },
  castleName: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 15,
  },
  castleMeta: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: 13,
  },
  reachedMeta: { color: theme.colors.brandText },
  faint: { opacity: 0.45 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dimmedStar: { opacity: 0.3 },
  more: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.bold,
    fontSize: 13,
  },
  milestone: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.bold,
    fontSize: 13,
  },
  laterNamed: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingTop: theme.spacing.md,
    color: theme.colors.inkMuted,
    opacity: 0.7,
    fontFamily: theme.typography.body,
    fontSize: 13,
  },
  earlier: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: EARLIER_ROW,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
}));
