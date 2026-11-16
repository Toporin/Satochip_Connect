/**
 * Satodime vault account.
 *
 * One account = one vault (key slot) of a Satodime card. No PIN: signing needs
 * the card, an UNSEALED vault and the card unlock secret stored on this device.
 * Sealed vaults are watch-only.
 */
import type { SatodimeCard } from 'satochip-react-native';

import {
  ISatodimeWallet,
  SatodimeInfo,
  SatodimeVaultState,
  WalletError,
  WalletErrorType,
  WalletType,
} from '@/types/WalletTypes';
import { NFCManager } from '@/wallets/nfc/NFCManager';
import { TransactionRequest } from '@/utils/EIP155Utils';
import { decodeSatodimeSlip44, SatodimeNetwork } from '@/constants/Satodime';
import { SatodimeSignOptions, SatodimeUnlockRequired, signDigestWithSatodime } from './SatodimeClient';
import {
  DigestSigner,
  signMessageWithDigestSigner,
  signTransactionWithDigestSigner,
  signTypedDataWithDigestSigner,
} from './SatodimeSigning';

export class SatodimeWallet implements ISatodimeWallet {
  public readonly type = WalletType.SATODIME;
  public readonly id: string;
  public readonly address: string;
  public readonly blockchain: string;
  public readonly satodimeInfo: SatodimeInfo;

  constructor(satodimeInfo: SatodimeInfo) {
    this.satodimeInfo = satodimeInfo;
    this.id = satodimeInfo.id;
    this.address = satodimeInfo.address;
    this.blockchain = satodimeInfo.blockchain;
  }

  /** Account id for a vault: unique per card authentikey and vault index. */
  static makeId(authentikey: string, vaultIndex: number): string {
    return `satodime-eip155-${authentikey.toLowerCase()}-${vaultIndex}`;
  }

  get network(): SatodimeNetwork {
    return decodeSatodimeSlip44(this.satodimeInfo.slip44);
  }

  /** Sealed vaults cannot sign (the applet only signs with unsealed vaults). */
  isWatchOnly(): boolean {
    return this.satodimeInfo.vaultState !== SatodimeVaultState.UNSEALED;
  }

  private cardSigner(card: SatodimeCard, options?: SatodimeSignOptions): DigestSigner {
    return (digest: Buffer) => signDigestWithSatodime(card, this.satodimeInfo, digest, options);
  }

  private wrapError(what: string, error: unknown): Error {
    if (error instanceof SatodimeUnlockRequired) {
      return error; // handled by signWithSatodimeUnlock (prompt + retry)
    }
    const cause = error instanceof Error ? error : new Error(String(error));
    console.error(`[Satodime] ${what} failed: ${cause.message}`);
    return new WalletError(WalletErrorType.SIGNING_FAILED, cause.message, cause);
  }

  public async signEthereumMessage(
    message: string,
    card: SatodimeCard,
    address: string,
    chainId: number,
    options?: SatodimeSignOptions,
  ): Promise<string> {
    try {
      return await signMessageWithDigestSigner(this.cardSigner(card, options), message, address, chainId);
    } catch (error) {
      throw this.wrapError('message signing', error);
    }
  }

  public async signEIP712TypedData(
    domain: any,
    types: any,
    data: any,
    card: SatodimeCard,
    address: string,
    chainId: number,
    options?: SatodimeSignOptions,
  ): Promise<string> {
    try {
      return await signTypedDataWithDigestSigner(this.cardSigner(card, options), domain, types, data, address, chainId);
    } catch (error) {
      throw this.wrapError('typed data signing', error);
    }
  }

  public async signEthereumTransaction(
    transaction: TransactionRequest,
    card: SatodimeCard,
    address: string,
    chainId: number,
    options?: SatodimeSignOptions,
  ): Promise<string> {
    try {
      return await signTransactionWithDigestSigner(this.cardSigner(card, options), transaction, address, chainId);
    } catch (error) {
      throw this.wrapError('transaction signing', error);
    }
  }

  // Base wallet interface methods
  public getAddress(): string {
    return this.satodimeInfo.address;
  }

  public async signMessage(_message: string | Uint8Array): Promise<string> {
    throw new WalletError(WalletErrorType.UNSUPPORTED_OPERATION, 'Use signEthereumMessage() instead - requires the card');
  }

  public async signTypedData(_domain: any, _types: any, _data: any): Promise<string> {
    throw new WalletError(WalletErrorType.UNSUPPORTED_OPERATION, 'Use signEIP712TypedData() instead - requires the card');
  }

  public async signTransaction(_transaction: any): Promise<string> {
    throw new WalletError(WalletErrorType.UNSUPPORTED_OPERATION, 'Use signEthereumTransaction() instead - requires the card');
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const nfcCapabilities = await NFCManager.getInstance().checkNFCAvailability();
      return nfcCapabilities.isAvailable && nfcCapabilities.isEnabled;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }

  public getWalletInfo(): SatodimeInfo {
    return this.satodimeInfo;
  }
}
