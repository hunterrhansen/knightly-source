import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { Body } from './foundation';
import { Screen } from './screen';
import { ScreenContent } from './screen-content';
import { ScreenHeader } from './screen-header';

const useStyles = createStyles((theme) => ({
  stack: { gap: theme.spacing.lg },
  section: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.panel,
  },
  heading: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  icon: {
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.title,
  },
  largeTitle: { fontSize: theme.typography.size.title * 1.5 },
  fill: { flex: 1, minWidth: 0 },
}));

function Content({
  message,
  width = 'reading',
}: {
  message?: string;
  width?: 'reading' | 'wide' | 'full';
}) {
  const styles = useStyles();
  return (
    <ScreenContent width={width} style={styles.stack}>
      <Body>
        {message ??
          'Header and content share the same gutters and width limit.'}
      </Body>
      {[
        'Look for checks',
        'Consider captures',
        'Notice threats',
        'Choose a move',
      ].map((title) => (
        <View key={title} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {title}
          </Text>
          <Body>Take a moment to study the position before continuing.</Body>
        </View>
      ))}
    </ScreenContent>
  );
}

const meta = {
  title: 'Layout/Screen header',
  component: ScreenHeader,
  args: { title: 'Daily practice' },
  argTypes: {
    titleMode: { control: 'radio', options: ['center', 'flex'] },
    width: { control: 'radio', options: ['reading', 'wide', 'full'] },
    startAction: { control: false },
    endAction: { control: false },
    style: { control: false },
    titleStyle: { control: false },
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
        <Screen preset={context.parameters.fixed ? 'fixed' : 'scroll'}>
          <Story />
          {!context.parameters.fixed && <Content width={context.args.width} />}
        </Screen>
      </View>
    ),
  ],
} satisfies Meta<typeof ScreenHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

function ActionsExample() {
  const [message, setMessage] = useState('Try Back or Finish review.');
  return (
    <>
      <ScreenHeader
        title="Game review"
        subtitle="Moment 2 of 7"
        startAction={{
          label: 'Back',
          onPress: () => setMessage('Back pressed'),
        }}
        endAction={{
          label: 'Finish review',
          onPress: () => setMessage('Finish review pressed'),
        }}
      />
      <ScreenContent>
        <Body>{message}</Body>
      </ScreenContent>
    </>
  );
}
export const UnequalActions: Story = { render: () => <ActionsExample /> };

export const NarrowLargeText: Story = {
  parameters: { frameWidth: 320 },
  render: function Render(args) {
    const styles = useStyles();
    return <ScreenHeader {...args} titleStyle={styles.largeTitle} />;
  },
  args: {
    title: 'Review your latest game',
    subtitle: 'Long headings wrap and increase the header height.',
    startAction: { label: 'Back', onPress: () => {} },
    endAction: { label: 'Save', disabled: true, onPress: () => {} },
  },
};

export const FlexibleWide: Story = {
  args: {
    title: 'Your games',
    titleMode: 'flex',
    width: 'wide',
    startAction: { label: 'Back', onPress: () => {} },
    endAction: { label: 'Import games', onPress: () => {} },
  },
  render: (args) => (
    <>
      <ScreenHeader {...args} />
      <ScreenContent width="wide">
        <Body>
          Flexible title placement uses the space between unequal actions.
        </Body>
      </ScreenContent>
    </>
  ),
};

export const FixedHeader: Story = {
  parameters: { fixed: true },
  render: () => {
    const styles = useStyles();
    return (
      <>
        <ScreenHeader
          title="Daily practice"
          subtitle="Header stays visible while content scrolls."
          startAction={{
            label: 'Close practice',
            content: <Text style={styles.icon}>×</Text>,
            onPress: () => {},
          }}
          endAction={{ label: 'Help', onPress: () => {} }}
        />
        <ScrollView style={styles.fill}>
          <Content />
          <Content message="Keep scrolling: the header is a sibling of this scroll view." />
        </ScrollView>
      </>
    );
  },
};
