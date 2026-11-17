/**
 * Ethereum signing on top of a raw digest signer (the Satodime card).
 *
 * Hashing, DER parsing (with low-S normalization), v recovery and transaction
 * serialization reuse the exact helpers of the Satochip wallet
 * (EIP155Utils / SignatureUtils). The digest signer returns a DER signature;
 * recoverVValue only accepts a v that recovers the account address, so a
 * signature made with any other key is rejected.
 */
import { ethers } from 'ethers';

import {
  TransactionRequest,
  computeUnsignedTransactionHash,
  createSignedTransaction,
  getTransactionType,
} from '@/utils/EIP155Utils';
import { parseDERSignature, recoverVValue } from '@/utils/SignatureUtils';

/** Signs a 32-byte digest and returns a DER-encoded ECDSA signature. */
export type DigestSigner = (digest: Buffer) => Promise<Buffer>;

function digestBytes(hashHex: string): Buffer {
  return Buffer.from(hashHex.slice(2), 'hex');
}

/** personal_sign / eth_sign: returns r ‖ s ‖ v (v = 27/28). */
export async function signMessageWithDigestSigner(
  signer: DigestSigner,
  message: string,
  address: string,
  chainId: number,
): Promise<string> {
  const messageBytes = ethers.utils.isHexString(message)
    ? ethers.utils.arrayify(message)
    : ethers.utils.toUtf8Bytes(message);
  const hash = ethers.utils.hashMessage(messageBytes);
  const { r, s } = parseDERSignature(await signer(digestBytes(hash)));
  const v = await recoverVValue(hash, r, s, address, chainId, 1, true);
  return r + s.slice(2) + v.toString(16).padStart(2, '0');
}

/** EIP-712 (types without EIP712Domain): returns r ‖ s ‖ v (v = 27/28). */
export async function signTypedDataWithDigestSigner(
  signer: DigestSigner,
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  data: Record<string, unknown>,
  address: string,
  chainId: number,
): Promise<string> {
  const hash = ethers.utils._TypedDataEncoder.hash(domain, types, data);
  const { r, s } = parseDERSignature(await signer(digestBytes(hash)));
  const v = await recoverVValue(hash, r, s, address, chainId, 1, true);
  return r + s.slice(2) + v.toString(16).padStart(2, '0');
}

/** Legacy (EIP-155) or EIP-1559 transaction: returns the serialized signed transaction. */
export async function signTransactionWithDigestSigner(
  signer: DigestSigner,
  transaction: TransactionRequest,
  address: string,
  chainId: number,
): Promise<string> {
  const { hash, unsignedTx } = computeUnsignedTransactionHash(transaction, chainId);
  const { r, s } = parseDERSignature(await signer(digestBytes(hash)));
  const v = await recoverVValue(hash, r, s, address, chainId, getTransactionType(transaction));
  return createSignedTransaction(unsignedTx, r, s, v, chainId);
}
