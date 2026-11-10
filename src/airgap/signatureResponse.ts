/**
 * Build the ERC-4527 `eth-signature` (CBOR tag 402) response.
 *
 * Signature bytes are r(32) ‖ s(32) ‖ v, where v is big-endian with no padding
 * (1 byte for 0/1/27/28, possibly more for a legacy EIP-155 v with a large
 * chain id). @keystonehq/base-eth-keyring reads `signature.slice(64)` as v.
 */
import { ethers } from 'ethers';
import { ETHSignature } from '@keystonehq/bc-ur-registry-eth';
import type { UR } from '@ngraveio/bc-ur';

import type { AirgapSignature } from './signing';

export const SIGNATURE_ORIGIN = 'Satochip-Connect';

export function encodeV(v: number): Buffer {
  if (!Number.isSafeInteger(v) || v < 0) {
    throw new Error(`Invalid v value: ${v}`);
  }
  if (v === 0) {
    return Buffer.from([0]);
  }
  let hex = v.toString(16);
  if (hex.length % 2) {
    hex = '0' + hex;
  }
  return Buffer.from(hex, 'hex');
}

export function signatureBytes(sig: AirgapSignature): Buffer {
  const r = Buffer.from(ethers.utils.arrayify(ethers.utils.hexZeroPad(sig.r, 32)));
  const s = Buffer.from(ethers.utils.arrayify(ethers.utils.hexZeroPad(sig.s, 32)));
  return Buffer.concat([r, s, encodeV(sig.v)]);
}

export function buildEthSignature(requestId: Buffer | undefined, sig: AirgapSignature): ETHSignature {
  return new ETHSignature(signatureBytes(sig), requestId, SIGNATURE_ORIGIN);
}

export function buildSignatureUR(requestId: Buffer | undefined, sig: AirgapSignature): UR {
  return buildEthSignature(requestId, sig).toUR() as unknown as UR;
}
