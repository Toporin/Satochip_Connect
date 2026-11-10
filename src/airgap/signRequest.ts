/**
 * Decode, validate and hash an ERC-4527 `eth-sign-request` (CBOR tag 401).
 *
 * Pure TypeScript (no React Native imports) so it can be unit tested in Node.
 *
 * The hash is ALWAYS computed over the exact `sign-data` bytes received.
 * Transactions are only RLP-decoded for display / validation, never re-serialized.
 */
import { ethers } from 'ethers';
import { EthSignRequest } from '@keystonehq/bc-ur-registry-eth';

import type { ScannedUR } from './urCodec';
import { normalizeXfp } from './syncPayload';

export const ETH_SIGN_REQUEST_UR_TYPE = 'eth-sign-request';
export const MAX_SIGN_DATA_BYTES = 256 * 1024;

/** Same numeric values as `DataType` in @keystonehq/bc-ur-registry-eth. */
export enum AirgapDataType {
  transaction = 1,
  typedData = 2,
  personalMessage = 3,
  typedTransaction = 4,
}

export type AirgapErrorCode =
  | 'WRONG_UR_TYPE'
  | 'MALFORMED'
  | 'TOO_LARGE'
  | 'WRONG_WALLET'
  | 'UNKNOWN_PATH'
  | 'ADDRESS_MISMATCH'
  | 'CHAIN_MISMATCH'
  | 'UNSUPPORTED_TYPE';

export class AirgapError extends Error {
  readonly code: AirgapErrorCode;
  constructor(code: AirgapErrorCode, message: string) {
    super(message);
    this.name = 'AirgapError';
    this.code = code;
  }
}

/** Minimal account info needed to match a request (subset of SatochipInfo). */
export interface AirgapAccount {
  id: string;
  name?: string;
  address: string;
  masterXfp: string;
  derivationPath: string;
}

export interface DisplayField {
  label: string;
  value: string;
}

export interface SignDisplay {
  kind: 'transaction' | 'typedData' | 'message';
  title: string;
  fields: DisplayField[];
  /** free text block: message text, typed-data message JSON, raw calldata */
  body?: string;
  bodyLabel?: string;
  warnings: string[];
  /** true when part of the payload could not be decoded into a readable form */
  undecodable: boolean;
}

export interface ParsedSignRequest<A extends AirgapAccount = AirgapAccount> {
  /** raw 16-byte request id (echoed in the response) */
  requestId?: Buffer;
  /** UUID string form of requestId (for logs / display) */
  requestIdString?: string;
  account: A;
  dataType: AirgapDataType;
  /** 0x-prefixed 32-byte hash to sign */
  hash: string;
  /** chain id (from the request or the transaction itself) */
  chainId?: number;
  /** transaction type for (typed) transactions: 0 legacy, 1, 2, 4 */
  txType?: number;
  origin?: string;
  derivationPath: string;
  display: SignDisplay;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a 16-byte request id as a UUID string. */
export function formatUuid(bytes: Buffer): string {
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Normalize `m/44'/60'/0'/0/0`, `44h/60h/0h/0/0`, ... to `44'/60'/0'/0/0`. */
export function normalizePath(path: string): string {
  return (path || '')
    .trim()
    .replace(/^[mM]\/?/, '')
    .replace(/[hH]/g, "'")
    .split('/')
    .filter(x => x.length > 0)
    .join('/');
}

const DATA_TYPE_LABELS: Record<number, string> = {
  1: 'Legacy transaction',
  2: 'Typed data (EIP-712)',
  3: 'Personal message',
  4: 'Typed transaction (EIP-2718)',
};

function toBN(item: unknown, label: string): ethers.BigNumber {
  if (typeof item !== 'string') {
    throw new AirgapError('MALFORMED', `Invalid ${label} in transaction`);
  }
  return ethers.BigNumber.from(item === '0x' ? 0 : item);
}

function toAddressOrEmpty(item: unknown): string | undefined {
  if (typeof item !== 'string') {
    throw new AirgapError('MALFORMED', 'Invalid recipient in transaction');
  }
  if (item === '0x') {
    return undefined;
  }
  if (ethers.utils.hexDataLength(item) !== 20) {
    throw new AirgapError('MALFORMED', 'Invalid recipient address length');
  }
  return ethers.utils.getAddress(item);
}

function toSafeNumber(bn: ethers.BigNumber, label: string): number {
  if (bn.gt('0x1fffffffffffff')) {
    throw new AirgapError('MALFORMED', `${label} is too large`);
  }
  return bn.toNumber();
}

function formatGwei(bn: ethers.BigNumber): string {
  return `${ethers.utils.formatUnits(bn, 'gwei')} gwei`;
}

function truncateHex(hex: string, maxChars = 2048): string {
  if (hex.length <= maxChars) {
    return hex;
  }
  return `${hex.slice(0, maxChars)}… (${(hex.length - 2) / 2} bytes total)`;
}

/** Returns the text if bytes are valid, printable UTF-8; undefined otherwise. */
export function printableUtf8(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0) {
    return '';
  }
  let text: string;
  try {
    text = ethers.utils.toUtf8String(bytes);
  } catch {
    return undefined;
  }
  // Reject control characters other than tab / newline / carriage return.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    return undefined;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Calldata decoding (small table of well-known selectors, no network needed)
// ---------------------------------------------------------------------------

const KNOWN_FUNCTIONS = new ethers.utils.Interface([
  'function transfer(address to, uint256 amount)',
  'function approve(address spender, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
  'function increaseAllowance(address spender, uint256 addedValue)',
  'function setApprovalForAll(address operator, bool approved)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function deposit()',
  'function withdraw(uint256 amount)',
]);

interface DecodedCall {
  fields: DisplayField[];
  warnings: string[];
  decoded: boolean;
  raw?: string;
}

export function decodeCalldata(data: string): DecodedCall {
  const warnings: string[] = [];
  if (!data || data === '0x') {
    return { fields: [], warnings, decoded: true };
  }
  const fields: DisplayField[] = [];
  const selector = data.slice(0, 10);
  try {
    const parsed = KNOWN_FUNCTIONS.parseTransaction({ data });
    fields.push({ label: 'Function', value: parsed.signature });
    parsed.functionFragment.inputs.forEach((input, i) => {
      const v = parsed.args[i];
      let value: string;
      if (ethers.BigNumber.isBigNumber(v)) {
        value = v.eq(ethers.constants.MaxUint256) ? 'UNLIMITED (2^256-1)' : v.toString();
      } else {
        value = String(v);
      }
      fields.push({ label: input.name || `arg${i}`, value });
    });
    if (
      (parsed.name === 'approve' || parsed.name === 'increaseAllowance') &&
      ethers.BigNumber.isBigNumber(parsed.args[1]) &&
      parsed.args[1].eq(ethers.constants.MaxUint256)
    ) {
      warnings.push('This approves UNLIMITED spending of your tokens.');
    }
    if (parsed.name === 'setApprovalForAll' && parsed.args[1] === true) {
      warnings.push('This gives the operator control over ALL your NFTs in this collection.');
    }
    return { fields, warnings, decoded: true, raw: data };
  } catch {
    fields.push({ label: 'Function selector', value: selector });
    return { fields, warnings, decoded: false, raw: data };
  }
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

interface TxInfo {
  txType: number;
  chainId: number;
  display: SignDisplay;
}

function buildTxDisplay(
  txType: number,
  chainId: number,
  nonce: ethers.BigNumber,
  gasLimit: ethers.BigNumber,
  fees: { gasPrice?: ethers.BigNumber; maxFeePerGas?: ethers.BigNumber; maxPriorityFeePerGas?: ethers.BigNumber },
  to: string | undefined,
  value: ethers.BigNumber,
  data: string,
  extra: { accessListLength?: number; authorizations?: DisplayField[] } = {},
): SignDisplay {
  const fields: DisplayField[] = [];
  const warnings: string[] = [];
  fields.push({ label: 'Type', value: txType === 0 ? 'Legacy (EIP-155)' : `EIP-2718 type ${txType}` });
  fields.push({ label: 'Chain ID', value: String(chainId) });
  fields.push({ label: 'To', value: to ?? 'Contract creation' });
  fields.push({ label: 'Value', value: `${ethers.utils.formatEther(value)} ETH` });
  fields.push({ label: 'Nonce', value: nonce.toString() });
  fields.push({ label: 'Gas limit', value: gasLimit.toString() });
  let maxFee: ethers.BigNumber;
  if (fees.gasPrice) {
    fields.push({ label: 'Gas price', value: formatGwei(fees.gasPrice) });
    maxFee = fees.gasPrice.mul(gasLimit);
  } else {
    fields.push({ label: 'Max fee per gas', value: formatGwei(fees.maxFeePerGas!) });
    fields.push({ label: 'Max priority fee', value: formatGwei(fees.maxPriorityFeePerGas!) });
    maxFee = fees.maxFeePerGas!.mul(gasLimit);
  }
  fields.push({ label: 'Max network fee', value: `${ethers.utils.formatEther(maxFee)} ETH` });

  if (!to) {
    warnings.push('This transaction deploys a new contract.');
  }
  if (extra.accessListLength) {
    fields.push({ label: 'Access list', value: `${extra.accessListLength} entr${extra.accessListLength === 1 ? 'y' : 'ies'}` });
  }
  if (extra.authorizations) {
    warnings.push(
      'EIP-7702 transaction: it carries code delegation authorizations. Only continue if you trust the delegated contracts.',
    );
    fields.push(...extra.authorizations);
  }

  const call = decodeCalldata(data);
  fields.push(...call.fields);
  warnings.push(...call.warnings);
  let body: string | undefined;
  let bodyLabel: string | undefined;
  if (data && data !== '0x') {
    body = truncateHex(data);
    bodyLabel = 'Data';
  }

  return {
    kind: 'transaction',
    title: 'Sign transaction',
    fields,
    body,
    bodyLabel,
    warnings,
    undecodable: !call.decoded,
  };
}

function decodeRlpList(bytes: Uint8Array): any[] {
  let decoded: any;
  try {
    decoded = ethers.utils.RLP.decode(bytes);
  } catch {
    throw new AirgapError('MALFORMED', 'Transaction data is not valid RLP');
  }
  if (!Array.isArray(decoded)) {
    throw new AirgapError('MALFORMED', 'Transaction data is not an RLP list');
  }
  return decoded;
}

function parseLegacyTx(bytes: Uint8Array): TxInfo {
  const items = decodeRlpList(bytes);
  if (items.length === 6) {
    throw new AirgapError(
      'UNSUPPORTED_TYPE',
      'Pre-EIP-155 legacy transactions (without chain id) are not supported.',
    );
  }
  if (items.length !== 9) {
    throw new AirgapError('MALFORMED', `Unexpected legacy transaction field count (${items.length})`);
  }
  const [nonce, gasPrice, gasLimit, to, value, data, chainId, r, s] = items;
  if (r !== '0x' || s !== '0x') {
    throw new AirgapError('MALFORMED', 'Unsigned EIP-155 transaction must end with (chainId, 0, 0)');
  }
  if (typeof data !== 'string') {
    throw new AirgapError('MALFORMED', 'Invalid transaction data');
  }
  const chainIdNum = toSafeNumber(toBN(chainId, 'chain id'), 'Chain id');
  if (chainIdNum <= 0) {
    throw new AirgapError('MALFORMED', 'Invalid chain id in transaction');
  }
  return {
    txType: 0,
    chainId: chainIdNum,
    display: buildTxDisplay(
      0,
      chainIdNum,
      toBN(nonce, 'nonce'),
      toBN(gasLimit, 'gas limit'),
      { gasPrice: toBN(gasPrice, 'gas price') },
      toAddressOrEmpty(to),
      toBN(value, 'value'),
      data,
    ),
  };
}

function parseTypedTx(bytes: Uint8Array): TxInfo {
  if (bytes.length < 2) {
    throw new AirgapError('MALFORMED', 'Typed transaction is too short');
  }
  const txType = bytes[0];
  if (txType >= 0x80) {
    throw new AirgapError('MALFORMED', 'Typed transaction must start with a type byte');
  }
  if (txType !== 1 && txType !== 2 && txType !== 4) {
    throw new AirgapError('UNSUPPORTED_TYPE', `Transaction type ${txType} is not supported.`);
  }
  const items = decodeRlpList(bytes.slice(1));
  const expectedLength = txType === 1 ? 8 : txType === 2 ? 9 : 10;
  if (items.length !== expectedLength) {
    throw new AirgapError('MALFORMED', `Unexpected type ${txType} transaction field count (${items.length})`);
  }
  const chainId = toSafeNumber(toBN(items[0], 'chain id'), 'Chain id');
  if (chainId <= 0) {
    throw new AirgapError('MALFORMED', 'Invalid chain id in transaction');
  }

  if (txType === 1) {
    const [, nonce, gasPrice, gasLimit, to, value, data, accessList] = items;
    if (typeof data !== 'string' || !Array.isArray(accessList)) {
      throw new AirgapError('MALFORMED', 'Invalid type 1 transaction');
    }
    return {
      txType,
      chainId,
      display: buildTxDisplay(
        txType,
        chainId,
        toBN(nonce, 'nonce'),
        toBN(gasLimit, 'gas limit'),
        { gasPrice: toBN(gasPrice, 'gas price') },
        toAddressOrEmpty(to),
        toBN(value, 'value'),
        data,
        { accessListLength: accessList.length },
      ),
    };
  }

  const [, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList] = items;
  if (typeof data !== 'string' || !Array.isArray(accessList)) {
    throw new AirgapError('MALFORMED', `Invalid type ${txType} transaction`);
  }
  let authorizations: DisplayField[] | undefined;
  if (txType === 4) {
    const authList = items[9];
    if (!Array.isArray(authList)) {
      throw new AirgapError('MALFORMED', 'Invalid EIP-7702 authorization list');
    }
    authorizations = authList.map((auth: any, i: number) => {
      if (!Array.isArray(auth) || auth.length !== 6) {
        throw new AirgapError('MALFORMED', 'Invalid EIP-7702 authorization entry');
      }
      const authChain = toBN(auth[0], 'authorization chain id').toString();
      const authAddr = toAddressOrEmpty(auth[1]) ?? '(none)';
      return {
        label: `Authorization #${i + 1}`,
        value: `delegate to ${authAddr} (chain ${authChain === '0' ? 'any' : authChain}, nonce ${toBN(auth[2], 'nonce').toString()})`,
      };
    });
    if (txType === 4 && toAddressOrEmpty(to) === undefined) {
      throw new AirgapError('MALFORMED', 'EIP-7702 transaction requires a recipient');
    }
  }
  return {
    txType,
    chainId,
    display: buildTxDisplay(
      txType,
      chainId,
      toBN(nonce, 'nonce'),
      toBN(gasLimit, 'gas limit'),
      {
        maxFeePerGas: toBN(maxFeePerGas, 'max fee per gas'),
        maxPriorityFeePerGas: toBN(maxPriorityFeePerGas, 'max priority fee per gas'),
      },
      toAddressOrEmpty(to),
      toBN(value, 'value'),
      data,
      { accessListLength: accessList.length, authorizations },
    ),
  };
}

// ---------------------------------------------------------------------------
// EIP-712
// ---------------------------------------------------------------------------

type TypedFields = Array<{ name: string; type: string }>;
type TypedTypes = Record<string, TypedFields>;

function baseType(type: string): string {
  const idx = type.indexOf('[');
  return idx === -1 ? type : type.slice(0, idx);
}

/** Keep only the struct types reachable from `primaryType` (eth-sig-util behaviour). */
export function pruneTypes(types: TypedTypes, primaryType: string): TypedTypes {
  const result: TypedTypes = {};
  const queue = [primaryType];
  while (queue.length) {
    const name = queue.shift()!;
    if (result[name] || !types[name]) {
      continue;
    }
    result[name] = types[name];
    for (const field of types[name]) {
      const b = baseType(field.type);
      if (types[b] && !result[b]) {
        queue.push(b);
      }
    }
  }
  return result;
}

export interface TypedDataPayload {
  types: TypedTypes;
  domain: Record<string, any>;
  primaryType: string;
  message: Record<string, any>;
}

/** EIP-712 v4 hash, using the declared EIP712Domain fields when present. */
export function hashTypedDataV4(typed: TypedDataPayload): string {
  const { types, domain, primaryType, message } = typed;
  let domainSeparator: string;
  if (Array.isArray(types.EIP712Domain)) {
    domainSeparator = ethers.utils._TypedDataEncoder
      .from({ EIP712Domain: types.EIP712Domain })
      .hash(domain);
  } else {
    domainSeparator = ethers.utils._TypedDataEncoder.hashDomain(domain);
  }
  const structTypes = pruneTypes(types, primaryType);
  delete structTypes.EIP712Domain;
  const messageHash =
    primaryType === 'EIP712Domain'
      ? undefined
      : ethers.utils._TypedDataEncoder.from(structTypes).hashStruct(primaryType, message);
  return ethers.utils.keccak256(
    ethers.utils.concat(['0x1901', domainSeparator, ...(messageHash ? [messageHash] : [])]),
  );
}

function parseTypedData(bytes: Uint8Array, requestChainId?: number): { hash: string; display: SignDisplay } {
  let typed: TypedDataPayload;
  try {
    typed = JSON.parse(ethers.utils.toUtf8String(bytes));
  } catch {
    throw new AirgapError('MALFORMED', 'Typed data is not valid UTF-8 JSON');
  }
  if (
    !typed ||
    typeof typed !== 'object' ||
    typeof typed.types !== 'object' ||
    typeof typed.domain !== 'object' ||
    typeof typed.primaryType !== 'string' ||
    typeof typed.message !== 'object'
  ) {
    throw new AirgapError('MALFORMED', 'Typed data must contain types, domain, primaryType and message');
  }
  if (!typed.types[typed.primaryType] && typed.primaryType !== 'EIP712Domain') {
    throw new AirgapError('MALFORMED', `Primary type "${typed.primaryType}" is not defined`);
  }

  let hash: string;
  try {
    hash = hashTypedDataV4(typed);
  } catch (e: any) {
    throw new AirgapError('MALFORMED', `Cannot encode typed data: ${e?.reason || e?.message || e}`);
  }

  const fields: DisplayField[] = [];
  const warnings: string[] = [];
  const d = typed.domain;
  if (d.name !== undefined) fields.push({ label: 'Domain name', value: String(d.name) });
  if (d.version !== undefined) fields.push({ label: 'Domain version', value: String(d.version) });
  if (d.chainId !== undefined) fields.push({ label: 'Domain chain ID', value: String(d.chainId) });
  if (d.verifyingContract !== undefined) {
    fields.push({ label: 'Verifying contract', value: String(d.verifyingContract) });
  }
  if (d.salt !== undefined) fields.push({ label: 'Salt', value: String(d.salt) });
  fields.push({ label: 'Primary type', value: typed.primaryType });

  if (
    requestChainId !== undefined &&
    d.chainId !== undefined &&
    String(Number(d.chainId)) !== String(requestChainId)
  ) {
    warnings.push(`Domain chain ID (${d.chainId}) differs from the request chain ID (${requestChainId}).`);
  }
  if (/permit/i.test(typed.primaryType)) {
    warnings.push('This is a token spending permit: it lets the spender move your tokens without another signature.');
  }
  if (Object.keys(typed.types).filter(t => t !== 'EIP712Domain').length === 0) {
    warnings.push('Typed data has no struct definitions.');
  }

  return {
    hash,
    display: {
      kind: 'typedData',
      title: 'Sign typed data',
      fields,
      body: JSON.stringify(typed.message, null, 2),
      bodyLabel: 'Message',
      warnings,
      undecodable: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Personal message
// ---------------------------------------------------------------------------

function parsePersonalMessage(bytes: Uint8Array): { hash: string; display: SignDisplay } {
  const hash = ethers.utils.hashMessage(bytes);
  const text = printableUtf8(bytes);
  const warnings: string[] = [];
  let undecodable = false;
  let body: string;
  if (text !== undefined) {
    body = text;
  } else {
    body = truncateHex(ethers.utils.hexlify(bytes));
    undecodable = true;
    if (bytes.length === 32) {
      warnings.push('The message looks like a 32-byte hash: you cannot see what you are really signing.');
    }
  }
  return {
    hash,
    display: {
      kind: 'message',
      title: 'Sign message',
      fields: [{ label: 'Length', value: `${bytes.length} bytes` }],
      body,
      bodyLabel: text !== undefined ? 'Message' : 'Message (hex)',
      warnings,
      undecodable,
    },
  };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function decodeEthSignRequest(cbor: Buffer): EthSignRequest {
  try {
    const req = EthSignRequest.fromCBOR(cbor);
    // force evaluation of required fields
    req.getDerivationPath();
    return req;
  } catch (e: any) {
    throw new AirgapError('MALFORMED', `Invalid eth-sign-request: ${e?.message || e}`);
  }
}

/** Match the request (xfp + full path + optional address) to a stored account. */
export function matchAccount<A extends AirgapAccount>(
  accounts: A[],
  sourceFingerprint: Buffer | undefined,
  path: string,
  address?: Buffer,
): A {
  if (!sourceFingerprint || sourceFingerprint.length !== 4) {
    throw new AirgapError('MALFORMED', 'Request has no source fingerprint.');
  }
  const xfp = sourceFingerprint.toString('hex').toLowerCase();
  const sameCard = accounts.filter(a => {
    try {
      return normalizeXfp(a.masterXfp) === xfp;
    } catch {
      return false;
    }
  });
  if (sameCard.length === 0) {
    throw new AirgapError('WRONG_WALLET', 'This request is for a different wallet.');
  }
  const normPath = normalizePath(path);
  const account = sameCard.find(a => normalizePath(a.derivationPath) === normPath);
  if (!account) {
    throw new AirgapError(
      'UNKNOWN_PATH',
      `This request uses derivation path m/${normPath}, which does not match any of your Satochip accounts. Add that account first.`,
    );
  }
  if (address && address.length > 0) {
    const requested = '0x' + address.toString('hex').toLowerCase();
    if (requested !== account.address.toLowerCase()) {
      throw new AirgapError('ADDRESS_MISMATCH', 'The request address does not match the account derived from its path.');
    }
  }
  return account;
}

export function parseSignRequestCBOR<A extends AirgapAccount>(cbor: Buffer, accounts: A[]): ParsedSignRequest<A> {
  if (cbor.length > MAX_SIGN_DATA_BYTES + 4096) {
    throw new AirgapError('TOO_LARGE', 'The request is too large.');
  }
  const req = decodeEthSignRequest(cbor);

  const signData = req.getSignData();
  if (!signData || !Buffer.isBuffer(signData) || signData.length === 0) {
    throw new AirgapError('MALFORMED', 'Request has no data to sign.');
  }
  if (signData.length > MAX_SIGN_DATA_BYTES) {
    throw new AirgapError('TOO_LARGE', 'The data to sign is too large.');
  }

  const dataType = req.getDataType() as number;
  if (![1, 2, 3, 4].includes(dataType)) {
    throw new AirgapError('UNSUPPORTED_TYPE', `Unsupported data type: ${dataType}`);
  }

  const rawChainId = req.getChainId();
  let requestChainId: number | undefined;
  if (rawChainId !== undefined && rawChainId !== null) {
    requestChainId = Number(rawChainId);
    if (!Number.isSafeInteger(requestChainId) || requestChainId < 0) {
      throw new AirgapError('MALFORMED', 'Invalid chain id in request');
    }
  }

  const path = req.getDerivationPath();
  if (!path) {
    throw new AirgapError('MALFORMED', 'Request has no derivation path.');
  }
  const addressBuf = req.getSignRequestAddress();
  if (addressBuf !== undefined && (!Buffer.isBuffer(addressBuf) || (addressBuf.length !== 0 && addressBuf.length !== 20))) {
    throw new AirgapError('MALFORMED', 'Invalid address in request');
  }
  const account = matchAccount(accounts, req.getSourceFingerprint(), path, addressBuf);

  const requestId = req.getRequestId();
  let requestIdString: string | undefined;
  if (requestId !== undefined) {
    if (!Buffer.isBuffer(requestId) || requestId.length !== 16) {
      throw new AirgapError('MALFORMED', 'Invalid request id');
    }
    requestIdString = formatUuid(requestId);
  }

  const bytes = new Uint8Array(signData);
  let hash: string;
  let display: SignDisplay;
  let chainId = requestChainId;
  let txType: number | undefined;

  switch (dataType) {
    case AirgapDataType.transaction:
    case AirgapDataType.typedTransaction: {
      const tx = dataType === AirgapDataType.transaction ? parseLegacyTx(bytes) : parseTypedTx(bytes);
      if (requestChainId !== undefined && requestChainId !== tx.chainId) {
        throw new AirgapError(
          'CHAIN_MISMATCH',
          `Chain id mismatch: request says ${requestChainId}, transaction says ${tx.chainId}.`,
        );
      }
      chainId = tx.chainId;
      txType = tx.txType;
      hash = ethers.utils.keccak256(bytes);
      display = tx.display;
      break;
    }
    case AirgapDataType.personalMessage: {
      ({ hash, display } = parsePersonalMessage(bytes));
      break;
    }
    case AirgapDataType.typedData: {
      ({ hash, display } = parseTypedData(bytes, requestChainId));
      break;
    }
    default:
      throw new AirgapError('UNSUPPORTED_TYPE', `Unsupported data type: ${dataType}`);
  }

  display.fields.unshift({ label: 'Request type', value: DATA_TYPE_LABELS[dataType] });

  return {
    requestId,
    requestIdString,
    account,
    dataType,
    hash,
    chainId,
    txType,
    origin: req.getOrigin() || undefined,
    derivationPath: `m/${normalizePath(path)}`,
    display,
  };
}

export function parseSignRequestUR<A extends AirgapAccount>(ur: ScannedUR, accounts: A[]): ParsedSignRequest<A> {
  if (ur.type !== ETH_SIGN_REQUEST_UR_TYPE) {
    throw new AirgapError('WRONG_UR_TYPE', `Unsupported QR code type "${ur.type}". Expected an Ethereum sign request.`);
  }
  return parseSignRequestCBOR(ur.cbor, accounts);
}
