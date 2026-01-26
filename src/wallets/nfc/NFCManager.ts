/**
 * NFC Manager for handling NFC operations and permissions
 * Updated for Phase 3: Real satochip-react-native integration
 */

// TODO refactor and remove?!

import { Alert } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { WalletError, WalletErrorType } from '@/types/WalletTypes';

export enum NFCState {
  UNKNOWN = 'unknown',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  DISABLED = 'disabled',
  PERMISSION_DENIED = 'permission_denied'
}

export interface NFCCapabilities {
  isAvailable: boolean;
  isEnabled: boolean;
  hasPermission: boolean;
  state: NFCState;
}

export class NFCManager {
  private static instance: NFCManager;
  private nfcState: NFCState = NFCState.UNKNOWN;
  private isSessionActive: boolean = false;

  private constructor() {}

  public static getInstance(): NFCManager {
    if (!NFCManager.instance) {
      NFCManager.instance = new NFCManager();
    }
    return NFCManager.instance;
  }

  /**
   * Check if NFC is available on the device
   */
  public async checkNFCAvailability(): Promise<NFCCapabilities> {
    try {
      // Initialize NFC Manager first
      await NfcManager.start();
      
      // Use real NFC manager functions as per the patch
      const isSupported = await NfcManager.isSupported();
      const isEnabled = await NfcManager.isEnabled();
      
      let state: NFCState;
      if (!isSupported) {
        state = NFCState.UNAVAILABLE;
      } else if (!isEnabled) {
        state = NFCState.DISABLED;
      } else {
        state = NFCState.AVAILABLE;
      }

      this.nfcState = state;

      return {
        isAvailable: isSupported,
        isEnabled: isEnabled,
        hasPermission: true, // NFC permission is handled at install time
        state
      };
    } catch (error) {
      console.error('Error checking NFC availability:', error);
      this.nfcState = NFCState.UNKNOWN;
      return {
        isAvailable: false,
        isEnabled: false,
        hasPermission: false,
        state: NFCState.UNKNOWN
      };
    }
  }

  /**
   * Request user to enable NFC settings
   */
  public async requestNFCPermissions(): Promise<boolean> {
    try {
      // As per the patch, use NfcManager.goToNfcSetting() to prompt user
      await NfcManager.goToNfcSetting();
      return true;
    } catch (error) {
      console.error('Error opening NFC settings:', error);
      return false;
    }
  }

  // /**
  //  * Check if NFC permission is granted
  //  */
  // private async checkNFCPermission(): Promise<boolean> {
  //   try {
  //     if (Platform.OS === 'android') {
  //       const result = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.NFC);
  //       return result === true;
  //     }
  //     // iOS handles NFC permissions differently
  //     return true;
  //   } catch (error) {
  //     console.error('Error checking NFC permission:', error);
  //     return false;
  //   }
  // }

  /**
   * Start an NFC session for card communication
   */
  public async startNFCSession(): Promise<void> {
    try {
      const capabilities = await this.checkNFCAvailability();
      
      if (!capabilities.isAvailable) {
        throw new WalletError(
          WalletErrorType.NFC_DISABLED,
          'NFC is not available on this device'
        );
      }

      if (!capabilities.isEnabled) {
        this.showNFCDisabledAlert();
        throw new WalletError(
          WalletErrorType.NFC_DISABLED,
          'NFC is disabled. Please enable NFC in your device settings.'
        );
      }

      // Start NFC session for ISO-DEP (smartcard) communication
      await NfcManager.requestTechnology(NfcTech.IsoDep);
      
      this.isSessionActive = true;
      console.log('NFC session started');
    } catch (error) {
      console.error('Error starting NFC session:', error);
      throw error;
    }
  }

  /**
   * Stop the active NFC session
   */
  public async stopNFCSession(): Promise<void> {
    try {
      if (this.isSessionActive) {
        await NfcManager.cancelTechnologyRequest();
        this.isSessionActive = false;
        console.log('NFC session stopped');
      }
    } catch (error) {
      console.error('Error stopping NFC session:', error);
    }
  }

  /**
   * Check if there's an active NFC session
   */
  public isSessionRunning(): boolean {
    return this.isSessionActive;
  }

  /**
   * Get current NFC state
   */
  public getCurrentState(): NFCState {
    return this.nfcState;
  }

  /**
   * Show alert when NFC is disabled
   */
  private showNFCDisabledAlert(): void {
    Alert.alert(
      'NFC Disabled',
      'NFC is required to use Satochip hardware wallets. Please enable NFC in your device settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Open Settings',
          onPress: () => {
            this.requestNFCPermissions(); // This will open NFC settings
          }
        }
      ]
    );
  }

  /**
   * Handle NFC related errors and provide user-friendly messages
   */
  public handleNFCError(error: any): WalletError {
    console.error('NFC Error:', error);

    if (error.message?.includes('NFC')) {
      return new WalletError(
        WalletErrorType.NFC_DISABLED,
        'NFC communication failed. Please ensure NFC is enabled and try again.',
        error
      );
    }

    if (error.message?.includes('permission')) {
      return new WalletError(
        WalletErrorType.NFC_DISABLED,
        'NFC permission is required to communicate with hardware wallets.',
        error
      );
    }

    return new WalletError(
      WalletErrorType.COMMUNICATION_ERROR,
      'Failed to communicate via NFC. Please try again.',
      error
    );
  }
}