import type { Meta, StoryObj } from '@storybook/react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard } from '../../chess/board/chessboard';
import { createStyles } from '../../theme/theme';
import { Button } from './button';
import { Body } from './foundation';
import { Screen } from './screen';
import { ScreenContent } from './screen-content';

const useStyles = createStyles((theme) => ({
  stack: { gap: theme.spacing.lg },
  title: {
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.title,
    color: theme.colors.ink,
  },
  heading: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  section: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.line,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg },
  board: {
    flexBasis: 280,
    flexGrow: 1,
    minWidth: 0,
    maxWidth: theme.layout.boardMax,
  },
  details: { flexBasis: 240, flexGrow: 1, minWidth: 0, gap: theme.spacing.md },
  preview: {
    maxWidth: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
}));

function LessonContent() {
  const styles = useStyles();
  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>
        Make time for your next lesson
      </Text>
      <Body>
        Review your games, revisit a useful pattern, and take one idea into your
        next game.
      </Body>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          Review a game
        </Text>
        <Body>
          Give the moves room to breathe. Longer text wraps inside the same
          content edges.
        </Body>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          Practice the pattern
        </Text>
        <Body>
          The content stays centered on desktop and fills the available space on
          a phone.
        </Body>
      </View>
      <Button onPress={() => {}}>Continue learning</Button>
    </>
  );
}

/** Story args are built once at module level; this reads the themed styles
 * when the story renders. */
function Themed({
  render,
}: {
  render: (styles: ReturnType<typeof useStyles>) => ReactNode;
}) {
  return render(useStyles());
}

const meta = {
  title: 'Layout/Screen content',
  component: ScreenContent,
  args: { width: 'reading', children: <LessonContent /> },
  render: function Render(args) {
    const styles = useStyles();
    return <ScreenContent style={styles.stack} {...args} />;
  },
  argTypes: {
    width: { control: 'radio', options: ['reading', 'wide', 'full'] },
    children: { control: false, table: { disable: true } },
    style: { control: false, table: { disable: true } },
  },
  decorators: [
    (Story, context) => (
      <View
        style={{
          width: context.parameters.frameWidth ?? '100%',
          maxWidth: '100%',
          height: 640,
        }}
      >
        <Screen>
          <Story />
        </Screen>
      </View>
    ),
  ],
} satisfies Meta<typeof ScreenContent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Reading: Story = {};

export const Narrow: Story = {
  parameters: { frameWidth: 320 },
};

export const WideBoardAndDetails: Story = {
  args: {
    width: 'wide',
    children: (
      <Themed
        render={(styles) => (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              Review a position
            </Text>
            <Body>
              Layout preview: board and details wrap into one column when space
              is limited.
            </Body>
            <View style={styles.row}>
              <View style={styles.board}>
                <Chessboard
                  position={{
                    id: 'screen-content-preview',
                    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                  }}
                  orientation="w"
                  policy={{ mode: 'read-only' }}
                  presentation={{
                    showDestinations: false,
                    highlights: [],
                    arrows: [],
                  }}
                  onAttempt={() => {}}
                />
              </View>
              <View style={styles.details}>
                <Text accessibilityRole="header" style={styles.heading}>
                  Look before you move
                </Text>
                <Body>
                  Consider checks, captures and threats. The board keeps its own
                  size limit while the surrounding content uses the wider frame.
                </Body>
                <Button onPress={() => {}}>Next position</Button>
              </View>
            </View>
          </>
        )}
      />
    ),
  },
};

export const FullWidth: Story = {
  args: {
    width: 'full',
    children: (
      <Themed
        render={(styles) => (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              Your learning overview
            </Text>
            <Body>
              Full width keeps the same gutters and leaves the available space
              to the content.
            </Body>
            <View style={styles.row}>
              {['Your games', 'Daily practice', 'Learning progress'].map(
                (title) => {
                  const styles = useStyles();
                  return (
                    <View key={title} style={[styles.section, styles.details]}>
                      <Text accessibilityRole="header" style={styles.heading}>
                        {title}
                      </Text>
                      <Body>
                        Preview content demonstrating a flexible column that
                        wraps on narrower screens.
                      </Body>
                    </View>
                  );
                },
              )}
            </View>
          </>
        )}
      />
    ),
  },
};

function ResizeExample() {
  const styles = useStyles();
  const [compact, setCompact] = useState(false);
  return (
    <>
      <ScreenContent style={styles.stack}>
        <Button onPress={() => setCompact((value) => !value)}>
          {compact ? 'Use wide frame' : 'Use compact frame'}
        </Button>
        <Body>Resize the container without changing the browser viewport.</Body>
      </ScreenContent>
      <View style={[styles.preview, { width: compact ? 320 : 1100 }]}>
        <ScreenContent style={styles.stack}>
          <LessonContent />
        </ScreenContent>
      </View>
    </>
  );
}
export const ResizeContainer: Story = { render: () => <ResizeExample /> };
