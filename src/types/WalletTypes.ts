// import { ethers } from 'ethers';

/**
 * Wallet Provider Types and Interfaces
 */
export enum WalletType {
  SOFTWARE = 'software',
  SATOCHIP = 'satochip',
  SATODIME = 'satodime',
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

/** Satodime vault state, as reported by the card (same values as the applet). */
export enum SatodimeVaultState {
  UNINITIALIZED = 0,
  SEALED = 1,
  UNSEALED = 2,
}

/**
 * One Satodime vault (key slot) used as an account.
 * Public data only: the card unlock secret is kept in the secure keychain,
 * keyed by the authentikey (see src/utils/SecretStore.ts).
 */
export interface SatodimeInfo extends WalletInfo {
  type: WalletType.SATODIME;
  /** Card authentikey, compressed public key (33 bytes hex, no 0x). Identifies the card. */
  authentikey: string;
  /** Vault (key slot) index on the card, 0..2. */
  vaultIndex: number;
  /** Vault public key, uncompressed (65 bytes hex, no 0x). */
  pubkey: string;
  /** Raw SLIP-44 value stored on the card (uint32), including the mainnet bit. */
  slip44: number;
  /** Vault state when last read from the card. */
  vaultState: SatodimeVaultState;
  /** Card label at import time, if any. */
  cardLabel?: string;
  /**
   * CVC card: the unlock code is engraved on the card and never changes (anyone
   * with the card can take ownership). Non-CVC card: a new random code is
   * created at each claim and only the claiming device knows it.
   * Undefined for accounts added before this was recorded.
   */
  fixedUnlockSecret?: boolean;
}

export interface SoftwareWalletInfo extends WalletInfo {
  type: WalletType.SOFTWARE;
  encryptedBlob: string;     // encrypted data
  /*
   * Public data recorded the first time the key material is available
   * (creation or unlock), for QR pairing with browser extensions:
   * - mnemonic accounts pair with ur:crypto-hdkey (xpub at m/44'/60'/0', like Satochip)
   * - private-key accounts pair with ur:crypto-account (single key)
   */
  /** Key material type, known once unlocked. */
  keyType?: 'mnemonic' | 'privateKey';
  /** Compressed public key of the account (33 bytes hex, no 0x). */
  publicKey?: string;
  /** Mnemonic accounts: full derivation path, e.g. m/44'/60'/0'/0/0. */
  derivationPath?: string;
  /** Mnemonic accounts: master fingerprint (8 uppercase hex, as SatochipInfo.masterXfp). */
  masterXfp?: string;
  /** Mnemonic accounts: account-level xpub at m/44'/60'/0'. */
  xpub?: string;
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

// Satodime specific interface
export interface ISatodimeWallet extends IWalletProvider {
  readonly type: WalletType.SATODIME;
  readonly satodimeInfo: SatodimeInfo;
  getWalletInfo(): SatodimeInfo;
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
  INVALID_GAS_FEE = 'INVALID_GAS_FEE',
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