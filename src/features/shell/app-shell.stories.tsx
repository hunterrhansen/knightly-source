import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Body, Page } from '../../ui';
import { TodayScreen, todaySamples } from '../today/today-api';
import { AppShell } from './app-shell';

function Preview() {
  const [path, setPath] = useState('/');
  return (
    <AppShell preview onPreviewNavigate={setPath}>
      {path === '/' ? (
        <TodayScreen
          state={todaySamples.Ready}
          actions={{ open: setPath, connectGames: () => {}, retry: () => {} }}
        />
      ) : (
        <Page
          title={
            path === '/games'
              ? 'Games'
              : path === '/progress'
                ? 'Progress'
                : 'Account & settings'
          }
        >
          <Body>Navigation preview — sample content.</Body>
        </Page>
      )}
    </AppShell>
  );
}
const meta = {
  title: 'Navigation/Restored shell',
  component: Preview,
  decorators: [
    (Story) => (
      <View style={{ height: 850 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
