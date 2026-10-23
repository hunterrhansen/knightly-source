import type { Preview } from '@storybook/react-native-web-vite';
import { AppProviders } from '../src/theme/app-providers';

const preview: Preview = {
  decorators: [
    (Story) => (
      <AppProviders>
        <Story />
      </AppProviders>
    ),
  ],
  parameters: { layout: 'fullscreen' },
};
export default preview;
