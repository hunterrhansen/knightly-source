import type { Meta, StoryObj } from '@storybook/react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { Button } from './button';
import { Body } from './foundation';
import { Screen } from './screen';
import { ScreenContent } from './screen-content';

const useStyles = createStyles((theme) => ({
  content: {
    gap: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.title,
    color: theme.colors.ink,
  },
  label: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  large: { fontSize: theme.typography.size.title * 1.5 },
  section: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.line,
  },
  fixed: { flex: 1, justifyContent: 'space-between' },
  footer: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceMuted,
  },
  input: {
    minHeight: theme.layout.minControl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.control,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
}));

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
  title: 'Layout/Screen',
  component: Screen,
  args: { preset: 'scroll' },
  decorators: [
    (Story) => (
      <View style={{ height: 640, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;

function Content({
  count = 3,
  large = false,
}: {
  count?: number;
  large?: boolean;
}) {
  const styles = useStyles();
  return (
    <ScreenContent style={styles.content}>
      <Text
        accessibilityRole="header"
        style={[styles.title, large && styles.large]}
      >
        Your learning space
      </Text>
      <Body>
        Screen owns the frame. This content owns its width, padding and layout.
      </Body>
      {Array.from({ length: count }, (_, index) => `Lesson ${index + 1}`).map(
        (lesson) => (
          <View key={lesson} style={styles.section}>
            <Text style={[styles.label, large && styles.large]}>{lesson}</Text>
            <Body>
              Review a position from your games and practice the pattern.
            </Body>
          </View>
        ),
      )}
      <Button onPress={() => {}}>Continue learning</Button>
    </ScreenContent>
  );
}

export const Scroll: Story = { args: { children: <Content count={12} /> } };
export const Fixed: Story = {
  args: {
    preset: 'fixed',
    children: (
      <Themed
        render={(styles) => (
          <View style={styles.fixed}>
            <Content count={1} />
            <View style={styles.footer}>
              <Body>This footer stays inside the fixed frame.</Body>
            </View>
          </View>
        )}
      />
    ),
  },
};

function AutoExample() {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  return (
    <Screen preset="auto">
      <ScreenContent style={styles.content}>
        <Button onPress={() => setExpanded(!expanded)}>
          {expanded ? 'Show short content' : 'Show overflowing content'}
        </Button>
      </ScreenContent>
      <Content count={expanded ? 12 : 1} />
    </Screen>
  );
}
export const Auto: Story = { render: () => <AutoExample /> };
export const NarrowLargeText: Story = {
  args: { children: <Content count={6} large /> },
  decorators: [
    (Story) => (
      <View style={{ width: 320, flex: 1 }}>
        <Story />
      </View>
    ),
  ],
};
export const Wide: Story = {
  args: { children: <Content count={6} /> },
  decorators: [
    (Story) => (
      <View style={{ width: '100%', maxWidth: 1100, flex: 1 }}>
        <Story />
      </View>
    ),
  ],
};
export const KeyboardForm: Story = {
  args: {
    avoidKeyboard: true,
    safeAreaEdges: ['top', 'bottom'],
    children: (
      <Themed
        render={(styles) => (
          <>
            <Content count={4} />
            <ScreenContent style={styles.content}>
              <Text style={styles.label}>Chess.com username</Text>
              <TextInput
                accessibilityLabel="Chess.com username"
                placeholder="Enter username"
                style={styles.input}
              />
              <Button onPress={() => {}}>Connect games</Button>
            </ScreenContent>
          </>
        )}
      />
    ),
  },
};
