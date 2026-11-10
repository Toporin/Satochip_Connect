module.exports = {
  preset: 'react-native',
  // shared test helpers live next to the tests but are not test suites
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/.*/helpers\\.ts$'],
};
