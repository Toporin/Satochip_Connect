/**
 * Signature Utilities
 * Elliptic curve signature parsing and recovery utilities for Ethereum transactions
 */

import { ethers } from 'ethers';

/**
 * Parse DER encoded signature to extract r and s components
 * Handles DER format from hardware wallets and applies BIP62 low-S rule
 */
export function parseDERSignature(derBuffer: Buffer): { r: string; s: string } {
  let offset = 0;

  // Check for DER sequence tag (0x30)
  if (derBuffer[offset] !== 0x30) {
    throw new Error('Invalid DER signature: missing sequence tag');
  }
  offset += 1;

  // Skip sequence length
  offset += 1;

  // Parse r value
  if (derBuffer[offset] !== 0x02) {
    throw new Error('Invalid DER signature: missing integer tag for r');
  }
  offset += 1;

  const rLength = derBuffer[offset];
  offset += 1;

  // Handle potential leading zero in r
  let rStart = offset;
  let rActualLength = rLength;
  if (derBuffer[rStart] === 0x00) {
    rStart += 1;
    rActualLength -= 1;
  }

  const r = derBuffer.slice(rStart, rStart + rActualLength);
  offset = rStart + rActualLength;

  // Parse s value
  if (derBuffer[offset] !== 0x02) {
    throw new Error('Invalid DER signature: missing integer tag for s');
  }
  offset += 1;

  const sLength = derBuffer[offset];
  offset += 1;

  // Handle potential leading zero in s
  let sStart = offset;
  let sActualLength = sLength;
  if (derBuffer[sStart] === 0x00) {
    sStart += 1;
    sActualLength -= 1;
  }

  let s: Buffer = derBuffer.slice(sStart, sStart + sActualLength);
  s = enforceLowS(s);

  // Ensure r and s are 32 bytes each
  const rPadded = Buffer.concat([
    Buffer.alloc(Math.max(0, 32 - r.length)),
    r,
  ]).slice(-32);
  const sPadded = Buffer.concat([
    Buffer.alloc(Math.max(0, 32 - s.length)),
    s,
  ]).slice(-32);

  return {
    r: '0x' + rPadded.toString('hex'),
    s: '0x' + sPadded.toString('hex'),
  };
}

/**
 * Enforce BIP62 low-S rule for signatures
 * Ensures s value is in the lower half of the curve order
 */
export function enforceLowS(sBytes: Buffer): Buffer {
  const CURVE_ORDER =
    0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const HALF_CURVE_ORDER = CURVE_ORDER / 2n;

  let s = BigInt('0x' + sBytes.toString('hex'));

  if (s > HALF_CURVE_ORDER) {
    s = CURVE_ORDER - s;
  }

  const hex = s.toString(16).padStart(64, '0');

  return Buffer.from(hex, 'hex');
}

/**
 * Recover v value from signature components
 * Tries both recovery parameters (0 and 1) to find the correct one
 *
 * @param messageHash - Hash that was signed (0x prefixed hex string)
 * @param r - R component of signature (0x prefixed hex string)
 * @param s - S component of signature (0x prefixed hex string)
 * @param expectedAddress - Expected signer address (0x prefixed)
 * @param chainId - Chain ID for EIP-155
 * @param txType - Transaction type (0 = legacy, 2 = EIP-1559)
 * @returns The correct v value
 */
export async function recoverVValue(
  messageHash: string,
  r: string,
  s: string,
  expectedAddress: string,
  chainId: number,
  txType: number,
): Promise<number> {
  const address = expectedAddress.toLowerCase();

  // Try both possible recovery values
  for (const recoveryParam of [0, 1]) {
    try {
      let v: number;

      if (txType === 0) {
        // Legacy transaction: v = chainId * 2 + 35 + recoveryParam (EIP-155)
        v = chainId * 2 + 35 + recoveryParam;
      } else {
        // EIP-1559 and other typed transactions: v = recoveryParam (0 or 1)
        v = recoveryParam;
      }

      const signature = { r, s, v };
      const recoveredAddress = ethers.utils.recoverAddress(
        messageHash,
        signature,
      );

      if (recoveredAddress.toLowerCase() === address) {
        return v;
      }
    } catch {
      // Try next recovery value
    }
  }

  throw new Error('Could not recover correct v value from signature');
}
