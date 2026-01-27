/**
 * Satochip Hardware Wallet Implementation
 * Phase 3: Real satochip-react-native integration with actual NFC communications
 */

import { ethers } from 'ethers';
import { SatochipCard } from 'satochip-react-native';

import {
  ISatochipWallet,
  SatochipInfo,
  WalletError,
  WalletErrorType,
  WalletType,
} from '@/types/WalletTypes';
import { NFCManager } from '@/wallets/nfc/NFCManager';
import { signWithSatochip } from '@/wallets/satochip/SatochipClientNew';
import {
  TransactionRequest,
  computeUnsignedTransactionHash,
  createSignedTransaction,
  getTransactionType,
} from '@/utils/EIP155Utils';
import {
  parseDERSignature,
  recoverVValue,
} from '@/utils/SignatureUtils';

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
   * Low-level method that signs a raw hash with the Satochip card
   *
   * @param hash - Hash to sign (Buffer)
   * @param card - Satochip card instance
   * @param pin - PIN for the card
   * @returns DER-encoded signature
   */
  public async signTransactionHash(
    hash: Buffer,
    card: SatochipCard,
    pin: string,
  ): Promise<Buffer> {
    try {
      if (!card) {
        throw new WalletError(
          WalletErrorType.DEVICE_NOT_FOUND,
          'Satochip card instance is required',
        );
      }

      if (!pin) {
        throw new WalletError(
          WalletErrorType.AUTHENTICATION_FAILED,
          'PIN is required for signing',
        );
      }

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

  /**
   * Sign Ethereum message (personal_sign, eth_sign)
   * High-level method that handles hash computation and signature recovery
   *
   * @param message - Message to sign (hex string or UTF-8 string)
   * @param card - Satochip card instance
   * @param pin - PIN for the card
   * @param address - Expected signer address (for v recovery)
   * @param chainId - Chain ID for signature
   * @returns Ethereum signature (0x prefixed hex string)
   */
  public async signEthereumMessage(
    message: string,
    card: SatochipCard,
    pin: string,
    address: string,
    chainId: number,
  ): Promise<string> {
    try {
      // 1. Convert message to bytes
      const messageBytes = ethers.utils.isHexString(message)
        ? ethers.utils.arrayify(message)
        : ethers.utils.toUtf8Bytes(message);

      // 2. Compute hash
      const hashHexString = ethers.utils.hashMessage(messageBytes);
      const hashBytes = Buffer.from(hashHexString.slice(2), 'hex');

      // 3. Sign hash
      const derSig = await signWithSatochip(
        card,
        this.satochipInfo.masterXfp,
        this.satochipInfo.derivationPath,
        hashBytes,
        pin,
      );

      // 4. Parse DER signature
      const { r, s } = parseDERSignature(derSig);

      // 5. Recover v value
      const txType = 1; // anything except 0, returns a value between 0 and 1
      const v = await recoverVValue(
        hashHexString,
        r,
        s,
        address,
        chainId,
        txType,
      );

      // 6. Concatenate to Ethereum signature format
      return r + s.slice(2) + v.toString(16).padStart(2, '0');
    } catch (error) {
      console.error('Error signing Ethereum message:', error);
      throw new WalletError(
        WalletErrorType.SIGNING_FAILED,
        'Failed to sign Ethereum message with Satochip',
        error as Error,
      );
    }
  }

  /**
   * Sign EIP-712 typed data
   * High-level method for typed data signing
   *
   * @param domain - EIP-712 domain
   * @param types - Type definitions
   * @param data - Data to sign
   * @param card - Satochip card instance
   * @param pin - PIN for the card
   * @param address - Expected signer address (for v recovery)
   * @param chainId - Chain ID for signature
   * @returns Ethereum signature (0x prefixed hex string)
   */
  public async signEIP712TypedData(
    domain: any,
    types: any,
    data: any,
    card: SatochipCard,
    pin: string,
    address: string,
    chainId: number,
  ): Promise<string> {
    try {
      // 1. Compute typed data hash
      const hashHexString = ethers.utils._TypedDataEncoder.hash(
        domain,
        types,
        data,
      );
      const hashBytes = Buffer.from(hashHexString.slice(2), 'hex');

      // 2. Sign hash
      const derSig = await signWithSatochip(
        card,
        this.satochipInfo.masterXfp,
        this.satochipInfo.derivationPath,
        hashBytes,
        pin,
      );

      // 3. Parse DER signature
      const { r, s } = parseDERSignature(derSig);

      // 4. Recover v value
      const txType = 1; // anything except 0, returns a value between 0 and 1
      const v = await recoverVValue(
        hashHexString,
        r,
        s,
        address,
        chainId,
        txType,
      );

      // 5. Concatenate to Ethereum signature format
      return r + s.slice(2) + v.toString(16).padStart(2, '0');
    } catch (error) {
      console.error('Error signing EIP-712 typed data:', error);
      throw new WalletError(
        WalletErrorType.SIGNING_FAILED,
        'Failed to sign EIP-712 typed data with Satochip',
        error as Error,
      );
    }
  }

  /**
   * Sign Ethereum transaction
   * High-level method that handles full transaction signing and serialization
   *
   * @param transaction - Transaction request object
   * @param card - Satochip card instance
   * @param pin - PIN for the card
   * @param address - Expected signer address (for v recovery)
   * @param chainId - Chain ID for transaction
   * @returns Serialized signed transaction (0x prefixed hex string)
   */
  public async signEthereumTransaction(
    transaction: TransactionRequest,
    card: SatochipCard,
    pin: string,
    address: string,
    chainId: number,
  ): Promise<string> {
    try {
      // 1. Compute unsigned transaction hash
      const { hash: unsignedHash, unsignedTx } =
        computeUnsignedTransactionHash(transaction, chainId);
      const unsignedHashBytes = Buffer.from(unsignedHash.slice(2), 'hex');

      // 2. Sign hash
      const derSig = await signWithSatochip(
        card,
        this.satochipInfo.masterXfp,
        this.satochipInfo.derivationPath,
        unsignedHashBytes,
        pin,
      );

      // 3. Parse DER signature
      const { r, s } = parseDERSignature(derSig);

      // 4. Recover v value
      const txType = getTransactionType(transaction);
      const v = await recoverVValue(
        unsignedHash,
        r,
        s,
        address,
        chainId,
        txType,
      );

      // 5. Create signed transaction
      return createSignedTransaction(unsignedTx, r, s, v, chainId);
    } catch (error) {
      console.error('Error signing Ethereum transaction:', error);
      throw new WalletError(
        WalletErrorType.SIGNING_FAILED,
        'Failed to sign Ethereum transaction with Satochip',
        error as Error,
      );
    }
  }

  // Base wallet interface methods
  public getAddress(): string {
    return this.satochipInfo.address;
  }

  public async signMessage(_message: string | Uint8Array): Promise<string> {
    throw new WalletError(
      WalletErrorType.UNSUPPORTED_OPERATION,
      'Use signEthereumMessage() instead - requires card and pin parameters',
    );
  }

  public async signTypedData(
    _domain: any,
    _types: any,
    _data: any,
  ): Promise<string> {
    throw new WalletError(
      WalletErrorType.UNSUPPORTED_OPERATION,
      'Use signEIP712TypedData() instead - requires card and pin parameters',
    );
  }

  public async signTransaction(_transaction: any): Promise<string> {
    throw new WalletError(
      WalletErrorType.UNSUPPORTED_OPERATION,
      'Use signEthereumTransaction() instead - requires card and pin parameters',
    );
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