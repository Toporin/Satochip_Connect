const {getDefaultConfig} = require('@react-native/metro-config');
const { withSentryConfig } = require("@sentry/react-native/metro");
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add local package to watch folders
config.watchFolders = [
  path.resolve(__dirname, '/home/satochip/Documents/goose/satochip-react-native')
];

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
    path.resolve(__dirname, '/home/satochip/Documents/goose/satochip-react-native/node_modules')
  ]
};

module.exports = withSentryConfig(config);