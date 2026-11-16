module.exports = {
  preset: 'react-native',
  // mocks for native modules (e.g. react-native-keychain)
  setupFiles: ['<rootDir>/jest/setup.js'],
  // shared test helpers live next to the tests but are not test suites
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/.*/helpers\\.ts$'],
};
