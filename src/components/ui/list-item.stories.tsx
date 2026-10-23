import type { Meta, StoryObj } from '@storybook/react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { Body } from './foundation';
import { ListItem } from './list-item';
import { Screen } from './screen';
import { ScreenContent } from './screen-content';
import { ScreenHeader } from './screen-header';

const useStyles = createStyles((theme) => ({
  stack: { gap: theme.spacing.lg },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.panel,
  },
  icon: {
    color: theme.colors.brandText,
    fontSize: theme.typography.size.title,
    fontFamily: theme.typography.heading,
  },
  accessory: {
    color: theme.colors.inkMuted,
    fontSize: theme.typography.size.small,
    fontFamily: theme.typography.body,
    textAlign: 'right',
  },
  badge: {
    color: theme.colors.brandText,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.control,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    textAlign: 'center',
  },
  largeLabel: { fontSize: theme.typography.size.body * 2 },
  largeDescription: { fontSize: theme.typography.size.small * 2 },
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
  title: 'UI/List item',
  component: ListItem,
  args: { label: 'Daily practice' },
  argTypes: {
    leading: { control: false },
    trailing: { control: false },
    onPress: { control: false },
    groupPosition: {
      control: 'select',
      options: [undefined, 'only', 'first', 'middle', 'last'],
    },
    style: { control: false },
    labelStyle: { control: false },
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
            <ScreenHeader title="List items" subtitle="Shared row previews" />
            <ScreenContent style={styles.stack}>
              <Story />
            </ScreenContent>
          </Screen>
        </View>
      );
    },
  ],
} satisfies Meta<typeof ListItem>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Static: Story = {
  args: {
    description: 'A plain information row with no button semantics.',
    trailing: (
      <Themed
        render={(styles) => <Text style={styles.accessory}>6 positions</Text>}
      />
    ),
    bottomSeparator: true,
  },
};

function InteractiveExample() {
  const styles = useStyles();
  const [message, setMessage] = useState('Select a row to see its action.');
  return (
    <>
      <View style={styles.group}>
        <ListItem
          groupPosition="first"
          label="Daily practice"
          description="Revisit patterns from your games."
          leading={<Text style={styles.icon}>♞</Text>}
          trailing={<Text style={styles.icon}>›</Text>}
          onPress={() => setMessage('Daily practice selected')}
          bottomSeparator
        />
        <ListItem
          groupPosition="middle"
          label="Review a game"
          description="Work through a useful moment."
          trailing={<Text style={styles.badge}>New</Text>}
          accessibilityLabel="Review a game, Work through a useful moment, New"
          onPress={() => setMessage('Game review selected')}
          bottomSeparator
        />
        <ListItem
          groupPosition="last"
          label="Connect another account"
          description="Unavailable in this preview."
          onPress={() => setMessage('Disabled row activated')}
          disabled
        />
      </View>
      <Body>{message}</Body>
    </>
  );
}
export const InteractiveRows: Story = { render: () => <InteractiveExample /> };

export const Accessories: Story = {
  args: {
    label: 'Chess.com account',
    description: 'Games connected for review.',
    leading: <Themed render={(styles) => <Text style={styles.icon}>♟</Text>} />,
    trailing: (
      <Themed
        render={(styles) => <Text style={styles.badge}>Connected</Text>}
      />
    ),
    topSeparator: true,
    bottomSeparator: true,
  },
};

export const NarrowLargeText: Story = {
  parameters: { frameWidth: 320 },
  render: function Render(args) {
    const styles = useStyles();
    return (
      <ListItem
        {...args}
        labelStyle={styles.largeLabel}
        descriptionStyle={styles.largeDescription}
      />
    );
  },
  args: {
    label: 'Review your latest tournament game',
    description:
      'Long labels and descriptions grow the row without truncating your next action.',
    leading: <Themed render={(styles) => <Text style={styles.icon}>♞</Text>} />,
    trailing: (
      <Themed render={(styles) => <Text style={styles.icon}>›</Text>} />
    ),
    onPress: () => {},
    bottomSeparator: true,
  },
};

export const MixedList: Story = {
  render: () => {
    const styles = useStyles();
    return (
      <View style={styles.group}>
        <ListItem
          groupPosition="first"
          label="Your account"
          description="hunter@example.com"
        />
        <ListItem
          groupPosition="middle"
          label="Learning language"
          trailing={<Text style={styles.accessory}>English</Text>}
          topSeparator
        />
        <ListItem
          groupPosition="last"
          label="Manage connected games"
          description="Choose where your games come from."
          onPress={() => {}}
          trailing={<Text style={styles.icon}>›</Text>}
          topSeparator
        />
      </View>
    );
  },
};
