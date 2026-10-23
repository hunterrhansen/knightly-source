import { type Href, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { Card, usePressSquish } from '../../ui';
import type { comingUp } from './path-model';
import { TrackGlyph } from './track-glyph';
import {
  heldLine,
  lessonDetail,
  type PathLesson,
  type PathPost,
} from './ward-path';

// The cards for the ward path's posts (docs/specs/2026-10-20-ward-path-design.md):
// the current post (from the banner's About), and one ahead, behind or blocked.
// What clears a lesson is said in plain words; no percentage, no estimate of
// when.

const TRACK_NAMES: Record<string, string> = {
  tactic: 'Tactic',
  defence: 'Defence',
  mate: 'Mate',
  endgame: 'Endgame',
  calculation: 'Calculation',
  opening: 'Opening',
  positional: 'Positional',
};
const trackName = (track: string) => TRACK_NAMES[track] ?? track;

// Four of every watch's ten items are the post's (backend mix.SLOTS), and only
// answers since the post was reached count toward it: the Steps Method's bar.
const CLEARS =
  'Every watch brings four of this post’s positions. A lesson is held once you’ve answered 36 of them and got 10 of your last 12 right. If your own games already show it, one page of 12 is enough.';
// The order is theirs; every position and word here is Knightly's own.
const CREDIT =
  'Lessons follow the order of the Steps Method by Rob Brunia and Cor van Wijgerden.';

/** The post's knight line and its note from the old books. */
function PostStory({ post }: { post: PathPost }) {
  const styles = useStyles();
  return (
    <>
      {post.line && <Text style={styles.line}>{`“${post.line}”`}</Text>}
      {post.lore && (
        <View style={styles.lore}>
          <Text style={styles.eyebrow}>From the old books</Text>
          <Text style={styles.quiet}>{post.lore}</Text>
        </View>
      )}
    </>
  );
}

/** A lesson of the post. On a post reached, it replays the lesson's intro
 * (the knight's explanation, the demonstration and a first try). */
function LessonRow({
  lesson,
  replay,
}: {
  lesson: PathLesson;
  replay: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const squish = usePressSquish({ squash: tokens.motion.squash.surface });
  const label = `${lesson.name}, ${trackName(lesson.track)}. ${lessonDetail(lesson)}`;
  const content = (
    <>
      <TrackGlyph
        track={lesson.track}
        size={20}
        color={lesson.teachable ? theme.colors.ink : theme.colors.inkMuted}
      />
      <Text
        style={[styles.rowName, !lesson.teachable && styles.muted]}
        numberOfLines={2}
      >
        {lesson.name}
      </Text>
      <Text
        style={[
          styles.rowState,
          lesson.held && styles.held,
          !lesson.teachable && styles.muted,
        ]}
      >
        {lessonDetail(lesson)}
      </Text>
      {replay && <Text style={styles.intro}>Intro ›</Text>}
    </>
  );
  if (!replay)
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Plays the lesson’s intro"
      onPress={() =>
        router.push(
          `/lesson-intro?key=${encodeURIComponent(lesson.key)}` as Href,
        )
      }
      onPressIn={squish.onPressIn}
      onPressOut={squish.onPressOut}
    >
      <Animated.View style={[styles.row, squish.style]}>
        {content}
      </Animated.View>
    </Pressable>
  );
}

/** A post: ahead, cleared behind, or blocked. */
export function PostCard({ post }: { post: PathPost }) {
  const styles = useStyles();
  const status =
    post.state === 'cleared'
      ? 'Cleared'
      : post.state === 'blocked'
        ? 'Coming soon: none of its drills are built yet. It never holds you up.'
        : post.state === 'current'
          ? heldLine(post)
          : `Coming after ${post.index - 1 > 0 ? `post ${post.index - 1}` : 'the gate'}.`;
  return (
    <Card
      eyebrow={`${post.baileyName} · Post ${post.index} · ${post.rank}`}
      title={post.place}
      description={`${post.topic}. ${status}`}
    >
      <View style={styles.stack}>
        <PostStory post={post} />
        <View style={styles.rows}>
          {post.lessons.map((lesson) => (
            <LessonRow
              key={lesson.key}
              lesson={lesson}
              replay={post.state === 'current' || post.state === 'cleared'}
            />
          ))}
        </View>
        {post.state === 'current' && (
          <Text style={styles.clears}>{CLEARS}</Text>
        )}
        <Text style={styles.clears}>{CREDIT}</Text>
      </View>
    </Card>
  );
}

/** What comes back when, now that the nights are not nodes: tomorrow, then
 * the next nights the schedule serves with something due. */
export function ComingUp({ rows }: { rows: ReturnType<typeof comingUp> }) {
  const styles = useStyles();
  if (!rows.length) return null;
  return (
    <View style={styles.coming}>
      <Text accessibilityRole="header" style={styles.eyebrow}>
        Coming up
      </Text>
      {rows.map((row) => (
        <View
          key={row.key}
          accessible
          accessibilityLabel={
            row.detail ? `${row.title}. ${row.detail}` : row.title
          }
        >
          <Text style={styles.comingTitle}>{row.title}</Text>
          {row.detail && <Text style={styles.quiet}>{row.detail}</Text>}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  clears: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  stack: { gap: theme.spacing.md },
  rows: { gap: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  intro: {
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    fontSize: 13,
  },
  rowName: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 15,
  },
  rowState: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: 13,
  },
  held: { color: theme.colors.brandText },
  muted: { color: theme.colors.inkMuted },
  line: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
  },
  lore: {
    gap: 2,
    borderTopWidth: 2,
    borderTopColor: theme.colors.line,
    paddingTop: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.eyebrow,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  coming: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.xs },
  comingTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 15,
  },
}));
