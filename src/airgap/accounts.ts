/**
 * Routing table for ERC-4527 sign requests (pure: no store, no native module).
 *
 * - Satochip accounts are matched by master fingerprint + full path ('hd').
 * - Single-key accounts (Satodime vaults, software accounts) are paired as
 *   crypto-account and matched by hash160(P)[0..4] + last path index ('single').
 *
 * Fingerprints and helper addresses only depend on the public key; they are
 * cached so routing never needs NFC, a PIN or a password.
 */
import type { AirgapAccount } from './signRequest';
import { buildSingleKeyPairing, singleKeyPath, SINGLE_KEY_PRIMARY_INDEX } from './singleKeyPayload';

export interface SingleKeyRoutingInfo {
  fingerprint: string;
  primaryAddress: string;
  helperAddresses: string[];
}

const routingCache = new Map<string, SingleKeyRoutingInfo>();

/** Fingerprint and the 5 addresses of a single-key account (cached per public key). */
export function singleKeyRoutingInfo(publicKey: string): SingleKeyRoutingInfo {
  const key = publicKey.toLowerCase().replace(/^0x/, '');
  let info = routingCache.get(key);
  if (!info) {
    const pairing = buildSingleKeyPairing(key, '');
    info = {
      fingerprint: pairing.fingerprint,
      primaryAddress: pairing.primaryAddress,
      helperAddresses: pairing.helperAddresses,
    };
    routingCache.set(key, info);
  }
  return info;
}

/** Routing entry for a single-key account; throws if the key does not match the address. */
export function singleKeyAirgapAccount(
  id: string,
  name: string,
  address: string,
  publicKey: string,
): AirgapAccount {
  const info = singleKeyRoutingInfo(publicKey);
  if (info.primaryAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error(`Public key of account ${name} does not match its address`);
  }
  return {
    id,
    name,
    address,
    masterXfp: info.fingerprint,
    derivationPath: singleKeyPath(SINGLE_KEY_PRIMARY_INDEX),
    kind: 'single',
    helperAddresses: info.helperAddresses,
  };
}
