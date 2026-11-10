/**
 * Turn a raw DER signature from the Satochip card into an Ethereum (r, s, v)
 * signature for an ERC-4527 request.
 *
 * Reuses `parseDERSignature` (which enforces low-s, EIP-2) and `recoverVValue`
 * (which tries both recovery ids and checks the signature recovers to the
 * expected address, throwing otherwise).
 */
import { ethers } from 'ethers';
import { parseDERSignature, recoverVValue } from '@/utils/SignatureUtils';
import { AirgapDataType } from './signRequest';

export interface AirgapSignature {
  /** 0x + 32 bytes */
  r: string;
  /** 0x + 32 bytes, low-s */
  s: string;
  /**
   * - legacy tx: EIP-155 v = chainId * 2 + 35 + recId
   * - typed tx: yParity 0 / 1
   * - personal message / typed data: 27 / 28
   */
  v: number;
}

const HALF_N = ethers.BigNumber.from(
  '0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0',
);

export async function finalizeSignature(
  hash: string,
  derSignature: Buffer,
  expectedAddress: string,
  dataType: AirgapDataType,
  chainId?: number,
): Promise<AirgapSignature> {
  const { r, s } = parseDERSignature(derSignature);
  if (ethers.BigNumber.from(s).gt(HALF_N)) {
    // parseDERSignature should already have normalized s; never return high-s.
    throw new Error('Signature is not low-s normalized');
  }

  let v: number;
  switch (dataType) {
    case AirgapDataType.personalMessage:
    case AirgapDataType.typedData:
      v = await recoverVValue(hash, r, s, expectedAddress, chainId ?? 1, 0, true);
      break;
    case AirgapDataType.transaction:
      if (!chainId) {
        throw new Error('A chain id is required for legacy transactions');
      }
      v = await recoverVValue(hash, r, s, expectedAddress, chainId, 0, false);
      break;
    case AirgapDataType.typedTransaction:
      v = await recoverVValue(hash, r, s, expectedAddress, chainId ?? 1, 2, false);
      break;
    default:
      throw new Error(`Unsupported data type ${dataType}`);
  }

  // Defense in depth: verify recovery once more with the final values.
  const recovered = ethers.utils.recoverAddress(hash, { r, s, v });
  if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error('Signature does not match the account address');
  }
  return { r, s, v };
}
