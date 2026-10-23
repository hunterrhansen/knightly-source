import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from './text-field';

const meta = {
  title: 'UI/Text field',
  component: TextField,
  args: {
    value: '',
    label: 'Game account username',
    placeholder: 'Username',
    autoCapitalize: 'none',
    autoCorrect: false,
  },
  render: function ControlledField(args) {
    const [value, setValue] = useState('');
    return <TextField {...args} value={value} onChangeText={setValue} />;
  },
  decorators: [
    (Story) => (
      <View style={{ padding: 24, width: '100%', maxWidth: 400 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: { helpText: 'Use your public chess-site username.' },
};
export const Invalid: Story = {
  args: { error: 'Enter a username to continue.' },
};
export const Busy: Story = {
  args: { editable: false, helpText: 'Checking your account…' },
};
export const Password: Story = {
  args: {
    label: 'Verification password',
    placeholder: 'Password',
    secureTextEntry: true,
    textContentType: 'password',
  },
};

export const LargeText: Story = {
  args: {
    label: 'A long account username label',
    style: { fontSize: 32 },
    helpText:
      'Check this field at a narrow width and with system text scaling.',
  },
};
