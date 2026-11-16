/* eslint-env jest */
/**
 * Jest-wide mocks for native modules that are not available in Node.
 */

// react-native-keychain (secure storage): in-memory store per service
jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
    STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
    setGenericPassword: async (username, password, options = {}) => {
      store.set(options.service, { username, password, service: options.service });
      return { service: options.service, storage: 'mock' };
    },
    getGenericPassword: async (options = {}) => {
      const entry = store.get(options.service);
      return entry ? { ...entry, storage: 'mock' } : false;
    },
    resetGenericPassword: async (options = {}) => store.delete(options.service),
  };
});
