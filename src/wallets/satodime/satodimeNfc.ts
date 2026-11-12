import { Platform } from 'react-native';
import NfcManager from 'react-native-nfc-manager';

/** User-facing message for an error raised during a Satodime NFC operation (closes the iOS NFC sheet with it). */
export function handleSatodimeError(error: unknown): string {
  const message =
    error instanceof Error && error.message ? error.message : 'Something went wrong, please try again!';
  if (Platform.OS === 'ios') {
    NfcManager.invalidateSessionWithErrorIOS(message).catch(() => undefined);
  }
  return message;
}
