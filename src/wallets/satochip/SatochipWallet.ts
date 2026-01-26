/**
 * Satochip Hardware Wallet Implementation
 * Phase 3: Real satochip-react-native integration with actual NFC communications
 */

import {
  ISatochipWallet,
  SatochipInfo,
  WalletError,
  WalletErrorType,
  WalletType,
} from '@/types/WalletTypes';
import { NFCManager } from '@/wallets/nfc/NFCManager';
import { signWithSatochip } from '@/wallets/SatochipClientNew';

export class SatochipWallet implements ISatochipWallet {
  public readonly type = WalletType.SATOCHIP;
  public readonly id: string;
  public readonly address: string;
  public readonly blockchain: string;
  public readonly derivationPath: string;
  public readonly satochipInfo: SatochipInfo;

  constructor(satochipInfo: SatochipInfo) {
    this.satochipInfo = satochipInfo;
    this.id = satochipInfo.id;
    this.address = satochipInfo.address;
    this.blockchain = satochipInfo.blockchain;
    this.derivationPath = satochipInfo.derivationPath;
  }

  /**
   * Sign transaction hash with Satochip
   * todo rename to signHash (as it can be from transaction or message)
   */
  public async signTransactionHash(hash: Buffer): Promise<Buffer> {
    try {

      // TODO: cache card + pin?
      const sig = await signWithSatochip(
        card,
        this.satochipInfo.masterXfp,
        this.satochipInfo.derivationPath,
        hash,
        pin,
      );

      return sig;
    } catch (error) {
      console.error('Error signing transaction hash:', error);
      throw new WalletError(
        WalletErrorType.SIGNING_FAILED,
        'Failed to sign transaction hash with Satochip',
        error as Error,
      );
    }
  }

  // Base wallet interface methods
  public getAddress(): string {
    return this.satochipInfo.address;
  }

  public async signMessage(message: string | Uint8Array): Promise<string> {
    try {
      const messageHash =
        typeof message === 'string'
          ? Buffer.from(message, 'utf8')
          : Buffer.from(message);

      const signature = await this.signTransactionHash(messageHash);
      return signature.toString('hex');
    } catch (error) {
      console.error('Error signing message:', error);
      throw new WalletError(
        WalletErrorType.SIGNING_FAILED,
        'Failed to sign message with Satochip',
        error as Error,
      );
    }
  }

  public async signTypedData(domain: any, types: any, data: any): Promise<string> {
    return "TODO";
  }

  public async signTransaction(transaction: any): Promise<string> {
    try {
      console.log(`signTransaction transaction: ${transaction}`);
      console.log(JSON.stringify(transaction));
      console.log(`signTransaction transaction.hash: ${transaction.hash}`);

      // compute the hash here
      const hash = Buffer.from(transaction.hash || transaction, 'hex');
      console.log(`signTransaction hash: ${hash.toString('hex')}`);
      const signature = await this.signTransactionHash(hash);
      return signature.toString('hex');
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new WalletError(
        WalletErrorType.SIGNING_FAILED,
        'Failed to sign transaction with Satochip',
        error as Error,
      );
    }
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const nfcManager = NFCManager.getInstance();
      const nfcCapabilities = await nfcManager.checkNFCAvailability();
      return nfcCapabilities.isAvailable && nfcCapabilities.isEnabled;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }

  public getWalletInfo(): SatochipInfo {
    return this.satochipInfo;
  }

}