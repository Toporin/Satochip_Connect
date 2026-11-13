/**
 * ERC-4527 pairing for single-key accounts (Satodime vaults, software accounts).
 *
 * A single key cannot be shared as an xpub (`crypto-hdkey`): extensions always
 * derive children from it. We use `ur:crypto-account` ("pubkey mode") instead:
 * the extension computes each address from the public key of each output
 * descriptor and remembers `address -> path`.
 *
 * MetaMask (@metamask/eth-qr-keyring) lists accounts in pages of 5 and fails
 * with fewer than 5 distinct addresses; Keystone's base-eth-keyring (Rabby)
 * rejects a descriptor count that is not a multiple of 5. So we publish
 * exactly 5 keys:
 *
 *   #1  P      path m/44'/60'/0'/0/0   <- the real account, the only one we sign for
 *   #2  2·P    path m/44'/60'/0'/0/1   helper
 *   #3  3·P    path m/44'/60'/0'/0/2   helper
 *   #4  4·P    path m/44'/60'/0'/0/3   helper
 *   #5  5·P    path m/44'/60'/0'/0/4   helper
 *
 * Helper i (index 1..4) has public key (i+1)·P, whose private key is
 * (i+1)·k mod n (k = account private key). The app NEVER signs for helpers,
 * but funds sent to one by mistake stay recoverable with k:
 *   - with k in software: sign with (i+1)·k mod n;
 *   - with a raw-hash signer holding only k (Satodime card): for a = i+1 and
 *     digest z, ask the card to sign z' = z·a⁻¹ mod n, giving (r, s'); then
 *     s = s'·a mod n is a valid signature of z for a·k (same r, recompute v).
 * See docs/airgap-single-key.md.
 *
 * The master fingerprint is hash160(P_compressed)[0..4], so sign requests
 * (fingerprint + path) can be routed without unlocking anything.
 */
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import {
  CryptoAccount,
  CryptoHDKey,
  CryptoKeypath,
  CryptoOutput,
  PathComponent,
} from '@keystonehq/bc-ur-registry-eth';
import type { UR } from '@ngraveio/bc-ur';

/** Number of keys published (MetaMask page size / Keystone multiple of 5). */
export const SINGLE_KEY_DESCRIPTOR_COUNT = 5;
/** Index (last path component) of the real account key. */
export const SINGLE_KEY_PRIMARY_INDEX = 0;
/** Origin path prefix; the last component is the key index 0..4. */
export const SINGLE_KEY_PATH_PREFIX = "m/44'/60'/0'/0";
/**
 * Note used by Keystone devices on their pubkey-mode (crypto-account) ETH
 * export. Neither extension changes behaviour with it (Keystone only stores a
 * flag, MetaMask stores it as `keyringAccount`).
 */
export const SINGLE_KEY_NOTE = 'account.ledger_live';

/** Device names shown by the extensions (same on every descriptor). */
export function satodimeDeviceName(vaultIndex: number): string {
  return `Satodime #${vaultIndex + 1} - use #1 only`;
}
export const SOFTWARE_DEVICE_NAME = 'SC Software - use #1 only';

function toCompressed(publicKey: string | Uint8Array): Uint8Array {
  const bytes = typeof publicKey === 'string' ? ethers.utils.arrayify(publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`) : publicKey;
  return secp256k1.ProjectivePoint.fromHex(bytes).toRawBytes(true);
}

/** hash160(P_compressed)[0..4] as 8 lowercase hex chars. */
export function singleKeyFingerprint(publicKey: string | Uint8Array): string {
  const compressed = toCompressed(publicKey);
  const h160 = ethers.utils.ripemd160(ethers.utils.sha256(compressed));
  return h160.slice(2, 10);
}

/** [P, 2P, 3P, 4P, 5P] as compressed points (33 bytes each). */
export function helperPublicKeys(publicKey: string | Uint8Array): Uint8Array[] {
  const point = secp256k1.ProjectivePoint.fromHex(toCompressed(publicKey));
  const keys: Uint8Array[] = [];
  for (let a = 1; a <= SINGLE_KEY_DESCRIPTOR_COUNT; a++) {
    keys.push(point.multiply(BigInt(a)).toRawBytes(true));
  }
  return keys;
}

/** Addresses of the 5 published keys; [0] is the account address. */
export function singleKeyAddresses(publicKey: string | Uint8Array): string[] {
  return helperPublicKeys(publicKey).map(k => ethers.utils.computeAddress(k));
}

export function singleKeyPath(index: number): string {
  return `${SINGLE_KEY_PATH_PREFIX}/${index}`;
}

export interface SingleKeyPairing {
  fingerprint: string;
  /** Account address (key #1). */
  primaryAddress: string;
  /** Helper addresses #2..#5 (never signed for). */
  helperAddresses: string[];
  ur: UR;
}

/** Build the `ur:crypto-account` pairing payload for a single-key account. */
export function buildSingleKeyPairing(publicKey: string | Uint8Array, name: string): SingleKeyPairing {
  const fingerprint = singleKeyFingerprint(publicKey);
  const fpBuffer = Buffer.from(fingerprint, 'hex');
  const keys = helperPublicKeys(publicKey);

  const outputs = keys.map((key, index) => {
    const origin = new CryptoKeypath(
      [
        new PathComponent({ index: 44, hardened: true }),
        new PathComponent({ index: 60, hardened: true }),
        new PathComponent({ index: 0, hardened: true }),
        new PathComponent({ index: 0, hardened: false }),
        new PathComponent({ index, hardened: false }),
      ],
      fpBuffer,
    );
    const hdKey = new CryptoHDKey({
      isMaster: false,
      isPrivateKey: false,
      key: Buffer.from(key),
      origin,
      name,
      note: SINGLE_KEY_NOTE,
    });
    return new CryptoOutput([], hdKey);
  });

  const addresses = keys.map(k => ethers.utils.computeAddress(k));
  return {
    fingerprint,
    primaryAddress: addresses[0],
    helperAddresses: addresses.slice(1),
    ur: new CryptoAccount(fpBuffer, outputs).toUR() as unknown as UR,
  };
}
