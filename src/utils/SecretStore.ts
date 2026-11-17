/**
 * Secure storage for card secrets (iOS Keychain / Android Keystore), via
 * react-native-keychain.
 *
 * Used for the Satodime unlock secret: it proves ownership of the card and is
 * needed to sign. Never store it in MMKV / AsyncStorage, never log it.
 */
import * as Keychain from 'react-native-keychain';

const SATODIME_SERVICE_PREFIX = 'io.satochip.connect.satodime.';
const SATODIME_USERNAME = 'unlock-secret';

function satodimeService(authentikeyHex: string): string {
  return SATODIME_SERVICE_PREFIX + authentikeyHex.toLowerCase().replace(/^0x/, '');
}

const SET_OPTIONS: Keychain.SetOptions = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
};

export const SecretStore = {
  /** Store the unlock secret of a Satodime card (identified by its authentikey). */
  async setSatodimeUnlockSecret(authentikeyHex: string, secret: Buffer): Promise<void> {
    const result = await Keychain.setGenericPassword(SATODIME_USERNAME, secret.toString('hex'), {
      ...SET_OPTIONS,
      service: satodimeService(authentikeyHex),
    });
    if (!result) {
      throw new Error('Could not store the card unlock secret in secure storage');
    }
  },

  /** Unlock secret of a Satodime card, or null if this device is not its owner. */
  async getSatodimeUnlockSecret(authentikeyHex: string): Promise<Buffer | null> {
    const credentials = await Keychain.getGenericPassword({ service: satodimeService(authentikeyHex) });
    if (!credentials || !/^[0-9a-f]{2,40}$/i.test(credentials.password)) {
      return null;
    }
    return Buffer.from(credentials.password, 'hex');
  },

  async hasSatodimeUnlockSecret(authentikeyHex: string): Promise<boolean> {
    return (await this.getSatodimeUnlockSecret(authentikeyHex)) !== null;
  },

  async deleteSatodimeUnlockSecret(authentikeyHex: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: satodimeService(authentikeyHex) });
  },
};
