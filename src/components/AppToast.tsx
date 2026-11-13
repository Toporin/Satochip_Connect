import React from 'react';
import {Platform} from 'react-native';
import Toast from 'react-native-toast-message';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

/**
 * Toast host. On Android the app draws edge-to-edge (enforced when targeting
 * SDK 35+), so a 0 offset puts toasts under the status bar and camera
 * cutout: offset them by the top safe-area inset instead.
 *
 * Rendered once at the app root, and again inside the WalletConnect modal:
 * on Android a modal is a separate window drawn above the root, so toasts
 * shown while it is open need a host inside it.
 */
export function AppToast() {
  const insets = useSafeAreaInsets();
  return (
    <Toast
      position="top"
      topOffset={Platform.select({ios: 80, android: insets.top + 8})}
    />
  );
}
