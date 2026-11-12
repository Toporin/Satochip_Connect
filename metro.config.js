const {getDefaultConfig} = require('@react-native/metro-config');
const { withSentryConfig } = require("@sentry/react-native/metro");
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// satochip-react-native may be linked from a local clone (yarn "portal:").
// In that case watch its real folder and resolve its dependencies from this
// app's node_modules (never from the clone's own node_modules).
const satochipLibDir = fs.realpathSync(path.resolve(__dirname, 'node_modules/satochip-react-native'));
const isSatochipLibLinked = !satochipLibDir.startsWith(path.resolve(__dirname) + path.sep);
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (isSatochipLibLinked) {
  config.watchFolders = [...(config.watchFolders ?? []), satochipLibDir];
}

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
    ...(isSatochipLibLinked
      ? [new RegExp(`^${escapeRegExp(path.join(satochipLibDir, 'node_modules'))}(/.*)?$`)]
      : []),
  ],
};

module.exports = withSentryConfig(config);