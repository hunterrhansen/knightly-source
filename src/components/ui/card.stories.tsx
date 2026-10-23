import type { Meta, StoryObj } from '@storybook/react-native';
import { type ComponentProps, useState } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { Button } from './button';
import { Card } from './card';
import { Body } from './foundation';
import { ListItem } from './list-item';
import { Screen } from './screen';
import { ScreenContent } from './screen-content';
import { ScreenHeader } from './screen-header';

const useStyles = createStyles((theme) => ({
  stack: { gap: theme.spacing.lg },
  largeTitle: { fontSize: theme.typography.size.title * 1.5 },
  largeDescription: { fontSize: theme.typography.size.body * 2 },
  roomy: { minHeight: 320 },
  meta: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  column: { flexBasis: 260, flexGrow: 1, minWidth: 0 },
}));

const meta = {
  title: 'UI/Card',
  component: Card,
  args: {
    title: 'Make time for your next lesson',
    description: 'One useful pattern can make a difference in your next game.',
    footer: 'Preview content; no learning progress is saved.',
  },
  argTypes: {
    tone: { control: 'radio', options: ['surface', 'muted'] },
    padding: { control: 'radio', options: ['default', 'none'] },
    footerPlacement: { control: 'radio', options: ['flow', 'bottom'] },
    children: { control: false },
    footer: { control: false },
    onPress: { control: false },
    style: { control: false },
    titleStyle: { control: false },
    descriptionStyle: { control: false },
  },
  decorators: [
    (Story, context) => {
      const styles = useStyles();
      return (
        <View
          style={{
            width: context.parameters.frameWidth ?? '100%',
            maxWidth: '100%',
            height: 640,
          }}
        >
          <Screen>
            <ScreenHeader
              title="Cards"
              subtitle="Heading, content and footer previews"
            />
            <ScreenContent style={styles.stack}>
              <Story />
            </ScreenContent>
          </Screen>
        </View>
      );
    },
  ],
} satisfies Meta<typeof Card>;
export default meta;
// Gallery controls edit static content; custom renders demonstrate actionable cards.
type Story = StoryObj<
  Omit<
    ComponentProps<typeof Card>,
    'onPress' | 'accessibilityLabel' | 'accessibilityHint' | 'disabled'
  >
>;

export const Default: Story = {};

function ActionsExample() {
  const styles = useStyles();
  const [message, setMessage] = useState(
    'Try a whole-card action or the separate footer button.',
  );
  return (
    <View style={styles.stack}>
      <Card
        title="Review a game"
        description="Work through an instructive moment."
        footer="Open game review →"
        onPress={() => setMessage('Game review card selected')}
        accessibilityLabel="Review a game, Work through an instructive moment, Open game review"
      />
      <Card
        title="Daily practice"
        description="A static card with its own footer action."
        footer={
          <Button onPress={() => setMessage('Practice footer selected')}>
            Start practice
          </Button>
        }
      >
        <Body>
          Children can compose content without making the entire surface a
          button.
        </Body>
      </Card>
      <Card
        title="Import more games"
        description="Unavailable in this preview."
        onPress={() => setMessage('Disabled card activated')}
        accessibilityLabel="Import more games, Unavailable in this preview"
        disabled
      />
      <Body>{message}</Body>
    </View>
  );
}
export const Actions: Story = { render: () => <ActionsExample /> };

export const NarrowLargeText: Story = {
  parameters: { frameWidth: 320 },
  render: function Render(args) {
    const styles = useStyles();
    return (
      <Card
        {...args}
        titleStyle={styles.largeTitle}
        descriptionStyle={styles.largeDescription}
      />
    );
  },
  args: {
    title: 'Learn from your tournament games',
    description:
      'Headings and descriptions wrap while the card grows to keep everything readable.',
  },
};

export const FooterAtBottom: Story = {
  render: () => {
    const styles = useStyles();
    return (
      <View style={styles.columns}>
        <View style={styles.column}>
          <Card
            title="Review a game"
            description="Keep related content together."
            style={styles.roomy}
            footerPlacement="bottom"
            footer="Your footer sits at the bottom."
          />
        </View>
        <View style={styles.column}>
          <Card
            title="Daily practice"
            description="A quieter surface using the same theme tokens."
            tone="muted"
            style={styles.roomy}
            footerPlacement="bottom"
            footer="Cards still grow when text needs room."
          />
        </View>
      </View>
    );
  },
};

function GroupedRowsExample() {
  const styles = useStyles();
  const [message, setMessage] = useState('Select a grouped row.');
  return (
    <View style={styles.stack}>
      <Card padding="none">
        <ListItem
          groupPosition="first"
          label="Your account"
          description="hunter@example.com"
          bottomSeparator
        />
        <ListItem
          groupPosition="middle"
          label="Review your games"
          onPress={() => setMessage('Review row selected')}
          bottomSeparator
        />
        <ListItem
          groupPosition="last"
          label="Manage connected games"
          onPress={() => setMessage('Connected games row selected')}
          trailing={<Text style={styles.meta}>›</Text>}
        />
      </Card>
      <Body>{message}</Body>
    </View>
  );
}
export const GroupedRows: Story = { render: () => <GroupedRowsExample /> };

/** The compact card used on Today and Progress: caps label, quiet meta and
 * small description, no big title. */
export const Eyebrow: Story = {
  args: {
    eyebrow: 'Keep going',
    meta: '3 left',
    title: undefined,
    description: 'Everything else waiting today. It’s optional.',
    footer: undefined,
    children: <Body>Content under the header.</Body>,
  },
};
