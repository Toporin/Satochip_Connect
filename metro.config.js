const {getDefaultConfig} = require('@react-native/metro-config');
const { withSentryConfig } = require("@sentry/react-native/metro");
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add SVG transformer configuration
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

// Update resolver with both SVG config and local package node_modules
config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter(ext => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
  // Don't watch native build outputs: Gradle/Xcode create & delete dirs there
  // during builds, which crashes Metro's fallback watcher (ENOENT) without watchman.
  blockList: [
    ...[].concat(config.resolver.blockList ?? []),
    /.*\/android\/.*\/build\/.*/,
    /.*\/ios\/build\/.*/,
  ],
};

module.exports = withSentryConfig(config);