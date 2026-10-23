import type { ExpoConfig } from 'expo/config';
import { type ConfigPlugin, withEntitlementsPlist } from 'expo/config-plugins';

// Reminders are local notifications, which need no push entitlement. Expo applies
// expo-notifications' plugin automatically, and it adds `aps-environment`; the App
// Store profile has no Push capability, so that entitlement fails signing.
const withoutPushEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (entitlements) => {
    delete entitlements.modResults['aps-environment'];
    return entitlements;
  });

const config: ExpoConfig = {
  name: 'Knightly',
  slug: 'knightly-rebuild',
  owner: 'hunterhansen',
  extra: { eas: { projectId: '4bb93474-d48f-44dd-a653-e9c414872dc1' } },
  version: '0.1.0',
  icon: './assets/app-icon/icon.png',
  scheme: 'knightlydev',
  // Dark only: native controls and system UI ignore the device's light setting.
  userInterfaceStyle: 'dark',
  // Portrait only, on phones and tablets.
  orientation: 'portrait',
  ios: {
    bundleIdentifier: 'app.knightlychess',
    supportsTablet: true,
    // iPad multitasking requires every orientation; opting out keeps iPad portrait.
    requireFullScreen: true,
    appleTeamId: 'GSMAB6KXN9',
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: 'app.knightlychess',
    adaptiveIcon: {
      foregroundImage: './assets/app-icon/adaptive-foreground.png',
      backgroundImage: './assets/app-icon/adaptive-background.png',
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/app-icon/icon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        // The board tile on brand green, matching the in-app launch
        // screen (src/components/ui/launch-screen.tsx); regenerate with
        // `npm run brand:generate`.
        backgroundColor: '#6cc23a',
        image: './assets/splash/launch-mark.png',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    'expo-dev-client',
    '@clerk/expo',
    'expo-secure-store',
    'expo-sharing',
    'expo-web-browser',
    [
      'expo-build-properties',
      { ios: { enableSceneSupport: true, deploymentTarget: '17.0' } },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default withoutPushEntitlement(config);
