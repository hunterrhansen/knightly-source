const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const path = require('node:path');
const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.dev &&
    process.env.STORYBOOK_ENABLED === 'true' &&
    moduleName === 'expo-router/entry'
  ) {
    return {
      type: 'sourceFile',
      filePath: path.join(__dirname, '.rnstorybook/index.tsx'),
    };
  }
  if (!context.dev && /(?:^|\/)shell-lab-screen$/.test(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: path.join(
        __dirname,
        'src/features/shell/production-lab-placeholder.tsx',
      ),
    };
  }
  return originalResolve
    ? originalResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// Separate development entry point: Storybook is never imported by app routes.
module.exports =
  process.env.STORYBOOK_ENABLED === 'true' &&
  process.env.NODE_ENV !== 'production'
    ? require('@storybook/react-native/withStorybook').withStorybook(config, {
        configPath: './.rnstorybook',
      })
    : config;
