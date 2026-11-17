/**
 * Satodime vault networks.
 *
 * A Satodime vault stores a SLIP-44 coin type (4 bytes, big-endian). By the
 * Satodime convention (Satodime-Android, pysatochip), the most significant bit
 * is SET for mainnet and CLEARED for testnet:
 *   ETH mainnet = 0x8000003C, ETH testnet = 0x0000003C.
 *
 * A SLIP-44 value names a coin, not an EVM chain. Each EVM coin therefore maps
 * to a default chain id (mainnet / testnet), which is used for display and as
 * the default chain for Send. The account itself can sign on any EVM chain,
 * like Satochip accounts.
 *
 * To support a new coin, add one entry to SATODIME_COINS.
 */
import { SatodimeVaultState } from '@/types/WalletTypes';

export const SLIP44_MAINNET_BIT = 0x80000000;

export interface SatodimeCoin {
  /** SLIP-44 coin type, without the mainnet bit. */
  slip44: number;
  symbol: string;
  name: string;
  /** EVM (EIP-155) coin: usable as an account in this app. */
  evm: boolean;
  /** Default chain id for mainnet vaults (EVM only). */
  mainnetChainId?: number;
  /** Default chain id for testnet vaults (EVM only). */
  testnetChainId?: number;
  testnetName?: string;
}

export const SATODIME_COINS: readonly SatodimeCoin[] = [
  { slip44: 60, symbol: 'ETH', name: 'Ethereum', evm: true, mainnetChainId: 1, testnetChainId: 11155111, testnetName: 'Sepolia' },
  // POL value used by Satodime-Android / javacryptotools (0x800003C6)
  { slip44: 966, symbol: 'POL', name: 'Polygon', evm: true, mainnetChainId: 137, testnetChainId: 80002, testnetName: 'Amoy' },
  { slip44: 0, symbol: 'BTC', name: 'Bitcoin', evm: false },
  { slip44: 2, symbol: 'LTC', name: 'Litecoin', evm: false },
  { slip44: 9, symbol: 'XCP', name: 'Counterparty', evm: false },
  { slip44: 145, symbol: 'BCH', name: 'Bitcoin Cash', evm: false },
];

export interface SatodimeNetwork {
  /** Known coin, or undefined for an unknown SLIP-44 value. */
  coin?: SatodimeCoin;
  symbol: string;
  /** Display name, e.g. "Ethereum", "Ethereum Sepolia (testnet)", "Unknown (SLIP-44 1234)". */
  label: string;
  isTestnet: boolean;
  /** true if the vault can be used as an EVM account in this app. */
  supported: boolean;
  /** Default EVM chain id (supported vaults only). */
  defaultChainId?: number;
}

/** Decode a raw SLIP-44 value read from a vault. */
/* eslint-disable no-bitwise -- SLIP-44 values are 32-bit flags */
export function decodeSatodimeSlip44(raw: number): SatodimeNetwork {
  const value = raw >>> 0;
  const isTestnet = (value & SLIP44_MAINNET_BIT) === 0;
  const coinType = value & 0x7fffffff;
  const coin = SATODIME_COINS.find(c => c.slip44 === coinType);
  if (!coin) {
    return {
      symbol: 'UNKNOWN',
      label: `Unknown (SLIP-44 ${coinType})${isTestnet ? ' testnet' : ''}`,
      isTestnet,
      supported: false,
    };
  }
  const label = isTestnet
    ? `${coin.name}${coin.testnetName ? ` ${coin.testnetName}` : ''} (testnet)`
    : coin.name;
  const defaultChainId = coin.evm ? (isTestnet ? coin.testnetChainId : coin.mainnetChainId) : undefined;
  return {
    coin,
    symbol: coin.symbol,
    label,
    isTestnet,
    supported: coin.evm && defaultChainId !== undefined,
    defaultChainId,
  };
}
/* eslint-enable no-bitwise */

export const SATODIME_VAULT_STATE_LABELS: Readonly<Record<SatodimeVaultState, string>> = {
  [SatodimeVaultState.UNINITIALIZED]: 'Uninitialized',
  [SatodimeVaultState.SEALED]: 'Sealed',
  [SatodimeVaultState.UNSEALED]: 'Unsealed',
};

/** Satodime protocol version required for on-card hash signing ("v0.2-0.1": protocol 0.2). */
export const SATODIME_MIN_PROTOCOL_VERSION = 0x0002;
