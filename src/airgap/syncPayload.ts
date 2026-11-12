/**
 * Build the ERC-4527 sync payload (`ur:crypto-hdkey`) for a Satochip account.
 *
 * Matches what @keystonehq/base-eth-keyring expects in `__readCryptoHDKey`:
 *  - origin = 44'/60'/0' with sourceFingerprint = master fingerprint
 *  - children = 0/* so that the keyring derives m/44'/60'/0'/0/i
 *  - parentFingerprint set so `getBip32Key()` reconstructs the exact xpub
 *  - note = "account.standard"
 */
import { ethers } from 'ethers';
import {
  CryptoHDKey,
  CryptoKeypath,
  PathComponent,
} from '@keystonehq/bc-ur-registry-eth';
import type { UR } from '@ngraveio/bc-ur';

export const SYNC_KEY_NAME = 'Satochip';
export const KEYRING_ACCOUNT_STANDARD = 'account.standard';

/** Account-level path whose xpub is stored for Satochip accounts. */
export const ACCOUNT_ORIGIN_COMPONENTS: Array<{ index: number; hardened: boolean }> = [
  { index: 44, hardened: true },
  { index: 60, hardened: true },
  { index: 0, hardened: true },
];

export interface SyncSource {
  /** 8 hex chars master fingerprint */
  masterXfp: string;
  /** account-level xpub at m/44'/60'/0' */
  xpub: string;
}

export function normalizeXfp(xfp: string): string {
  const clean = (xfp || '').replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(clean)) {
    throw new Error(`Invalid master fingerprint: ${xfp}`);
  }
  return clean;
}

export function buildCryptoHDKey(source: SyncSource, name: string = SYNC_KEY_NAME): CryptoHDKey {
  const xfp = normalizeXfp(source.masterXfp);
  const node = ethers.utils.HDNode.fromExtendedKey(source.xpub);
  if (node.depth !== 3 || node.index !== 0x80000000) {
    throw new Error(
      `Unexpected xpub depth/index (depth=${node.depth}, index=${node.index}); expected the account xpub at m/44'/60'/0'`,
    );
  }
  const key = Buffer.from(ethers.utils.arrayify(node.publicKey)); // compressed, 33 bytes
  const chainCode = Buffer.from(ethers.utils.arrayify(node.chainCode));
  const parentFingerprint = Buffer.from(ethers.utils.arrayify(node.parentFingerprint));

  const origin = new CryptoKeypath(
    ACCOUNT_ORIGIN_COMPONENTS.map(c => new PathComponent(c)),
    Buffer.from(xfp, 'hex'),
    3,
  );
  const children = new CryptoKeypath([
    new PathComponent({ index: 0, hardened: false }),
    new PathComponent({ hardened: false }), // wildcard
  ]);

  return new CryptoHDKey({
    isMaster: false,
    isPrivateKey: false,
    key,
    chainCode,
    origin,
    children,
    parentFingerprint,
    name,
    note: KEYRING_ACCOUNT_STANDARD,
  });
}

/** `ur:crypto-hdkey` UR for a Satochip account. */
export function buildSyncUR(source: SyncSource, name?: string): UR {
  return buildCryptoHDKey(source, name).toUR() as unknown as UR;
}
