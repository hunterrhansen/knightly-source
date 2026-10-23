import { Text, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { Card } from '../../ui';
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

// Every watch keeps three puzzles for the post (the server's POST_SHARE), and
// only puzzles solved since the post was reached count toward it.
const CLEARS =
  'Every watch brings three of this post’s puzzles. A lesson is held once you solve three of them first try here, or one if a move from your own games already shows it.';

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

function LessonRow({ lesson }: { lesson: PathLesson }) {
  const styles = useStyles();
  const { theme } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${lesson.name}, ${trackName(lesson.track)}. ${lessonDetail(lesson)}`}
    >
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
    </View>
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
            <LessonRow key={lesson.key} lesson={lesson} />
          ))}
        </View>
        {post.state === 'current' && (
          <Text style={styles.clears}>{CLEARS}</Text>
        )}
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
