// import { ethers } from 'ethers';

/**
 * Wallet Provider Types and Interfaces
 */
export enum WalletType {
  SOFTWARE = 'software',
  SATOCHIP = 'satochip'
}

export interface WalletInfo {
  id: string;
  name: string;
  type: WalletType;
  address: string;
  blockchain: string;
}

export interface SatochipInfo extends WalletInfo {
  type: WalletType.SATOCHIP;
  // isAuthentic: boolean; // todo remove?
  // cardLabel?: string; // todo remove?
  derivationPath: string;
  masterXfp: string; // 8 hex character master seed fingerprint
  xpub: string;
}

export interface SoftwareWalletInfo extends WalletInfo {
  type: WalletType.SOFTWARE;
  encryptedBlob: string;     // encrypted data
  //provider?: ethers.providers.Provider;
}

// store software wallet sensitive key material
export interface SensitiveInfo {
  keyType: 'mnemonic' | 'privateKey'; // todo: currently only mnemonic is supported
  mnemonic?: string;
  passphrase?: string;
  derivationPath?: string;
  privateKey?: string;
  extraEntropy?: string;
}

// Base wallet interface
export interface IWalletProvider {
  readonly type: WalletType;
  readonly id: string;
  readonly address: string;
  readonly blockchain: string;
  
  getAddress(): string;
  signMessage(message: string | Uint8Array): Promise<string>;
  signTypedData(domain: any, types: any, data: any): Promise<string>; // TODO
  signTransaction(transaction: any): Promise<string>;
  isAvailable(): Promise<boolean>;
  getWalletInfo(): WalletInfo;
}

// Satochip specific interface
export interface ISatochipWallet extends IWalletProvider {
  readonly type: WalletType.SATOCHIP;
  readonly satochipInfo: SatochipInfo;
  getWalletInfo(): SatochipInfo;
  // todo: add checkAuthenticity?
}

// Software wallet interface (existing wallets)
export interface ISoftwareWallet extends IWalletProvider {
  readonly type: WalletType.SOFTWARE;
  readonly softwareWalletInfo: SoftwareWalletInfo;
  readonly mnemonic?: string;
  getWalletInfo(): SoftwareWalletInfo;
  getMnemonic?(): string;
  exportPrivateKey?(): string;
}

// Wallet creation parameters
export interface CreateWalletParams {
  type: WalletType;
  blockchain: string;
  name?: string;
  mnemonic?: string; // For software wallets
  derivationPath?: string;
}

// Error types
export enum WalletErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  SIGNING_FAILED = 'SIGNING_FAILED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  INVALID_PIN = 'INVALID_PIN',
  PIN_BLOCKED = 'PIN_BLOCKED',
  NFC_DISABLED = 'NFC_DISABLED',
  COMMUNICATION_ERROR = 'COMMUNICATION_ERROR',
  WALLET_NOT_SET = 'WALLET_NOT_SET',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
}

export class WalletError extends Error {
  constructor(
    public type: WalletErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'WalletError';
  }
}