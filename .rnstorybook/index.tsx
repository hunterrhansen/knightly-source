import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerRootComponent } from 'expo';
import { AppProviders } from '../src/theme/app-providers';
import { view } from './storybook.requires';

const StorybookRoot = view.getStorybookUI({ storage: AsyncStorage });
function NativeGallery() {
  return (
    <AppProviders>
      <StorybookRoot />
    </AppProviders>
  );
}

registerRootComponent(NativeGallery);
