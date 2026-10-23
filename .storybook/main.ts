import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { StorybookConfig } from '@storybook/react-native-web-vite';

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  staticDirs: ['../public'],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      modulesToTranspile: ['victory-native'],
      pluginReactOptions: {
        babel: {
          plugins: [
            [
              'react-native-worklets/plugin',
              {
                // Vite appends query strings to TS filenames. Compile serialized
                // worklets as TS explicitly; those IDs cannot be read as map files.
                extraPresets: [
                  [
                    '@babel/preset-typescript',
                    { allExtensions: true },
                    'storybook-worklet-typescript',
                  ],
                ],
                disableSourceMaps: true,
              },
            ],
          ],
        },
      },
    },
  },
  core: { disableTelemetry: true },
  viteFinal: async (config) => {
    const { mergeConfig } = await import('vite');
    const assetRegistry = require.resolve(
      'react-native-web/dist/modules/AssetRegistry/index.js',
    );
    // The framework rewrites RN imports before resolution. Redirect Skia's
    // legacy asset lookup before that rewrite, using RN Web's actual registry.
    const skiaRegistryPlugin = {
      name: 'skia-web-asset-registry',
      enforce: 'pre' as const,
      transform(code: string, id: string) {
        if (id.endsWith('/expo-modules-core/src/ts-declarations/global.ts')) {
          // Expo uses these imports only in declarations. Explicit type imports
          // keep Vite's dev transform from requesting nonexistent runtime exports.
          return {
            code: code.replaceAll('import {', 'import type {'),
            map: null,
          };
        }
        if (
          !id.includes(
            '@shopify/react-native-skia/lib/module/Platform/Platform.web.js',
          )
        )
          return;
        return {
          code: code.replaceAll(
            '"react-native/Libraries/Image/AssetRegistry"',
            JSON.stringify(assetRegistry),
          ),
          map: null,
        };
      },
    };
    config.plugins = [skiaRegistryPlugin, ...(config.plugins ?? [])];
    return mergeConfig(config, {
      optimizeDeps: {
        exclude: ['victory-native'],
        include: ['react-fast-compare', 'its-fine'],
        rolldownOptions: { plugins: [skiaRegistryPlugin] },
      },
      define: { __DEV__: true, 'process.env.EXPO_OS': JSON.stringify('web') },
      resolve: {
        // Use Victory's published react-native entry so Babel can compile worklets.
        alias: [
          {
            find: /^victory-native$/,
            replacement: resolve(
              dirname(require.resolve('victory-native')),
              '../src/index.ts',
            ),
          },
        ],
        extensions: [
          '.web.tsx',
          '.web.ts',
          '.web.jsx',
          '.web.js',
          '.tsx',
          '.ts',
          '.jsx',
          '.js',
          '.json',
        ],
      },
    });
  },
};
export default config;
