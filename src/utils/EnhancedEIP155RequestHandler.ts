/**
 * Enhanced EIP155 Request Handler with Hardware Wallet Support
 * This shows how the existing request handler would be updated to use the new wallet abstraction
 */

import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils';
import { SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { ethers } from 'ethers';
import { SatochipCard } from 'satochip-react-native';

import {
  ISoftwareWallet,
  IWalletProvider,
  WalletError,
  WalletErrorType,
  WalletType,
} from '@/types/WalletTypes';

import {
  getEIP155AddressesFromParams,
  getSignParamsMessage,
  getSignTypedDataParamsData,
} from '@/utils/HelperUtil';
import {
  EIP155_RPCS_BY_CHAINS,
  EIP155_SIGNING_METHODS,
} from '@/constants/Eip155';
import SettingsStore from '@/store/SettingsStore.ts';
import { SatochipWallet } from '@/wallets/satochip/SatochipWallet.ts';
import { signWithSatochip } from '@/wallets/satochip/SatochipClientNew.ts';
import { EIP155SoftwareWallet } from '@/wallets/EIP155SoftwareWallet.ts';

type RequestEventArgs = Omit<
  SignClientTypes.EventArguments['session_request'],
  'verifyContext'
>;

// Transaction type definitions
interface TransactionRequest {
  from: string;
  to?: string;
  gas?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  value?: string;
  data?: string;
  nonce?: string;
  type?: number;
}

/**
 * Enhanced approve function that handles both software and hardware wallets
 */
export async function approveEIP155RequestEnhanced(
  requestEvent: RequestEventArgs,
  pin: string, // PIN for hardware wallets, password for software wallet
  card: SatochipCard,
  withModal: any,
  closeNfc: any,
) {

  const {params, id} = requestEvent;
  const {request} = params;

  // Get the address from params
  const address = getEIP155AddressesFromParams(params);
  console.log(`approveEIP155RequestEnhanced address: ${address}`);

  // Get chainId from params
  const chainId = extractChainId(params.chainId) ; // rams.chainId is a string with format: "eip155:1"
  console.log(`approveEIP155RequestEnhanced Signing chainId: ${chainId}`);

  let wallet: IWalletProvider | undefined;
  try {

    wallet = SettingsStore.getWalletByAddress(address);
    if (!wallet) {
      throw new WalletError(
        WalletErrorType.DEVICE_NOT_FOUND,
        `No wallet found for address: ${address}`
      );
    }

    // for software wallet, decrypt sensitive info using user credentials
    const walletType = wallet.type;
    if (walletType===WalletType.SOFTWARE && !(await wallet.isAvailable())){
      // unlock wallet with user provided password
      await (wallet as EIP155SoftwareWallet).unlockWallet(pin);
    }

    // Handle different signing methods
    switch (request.method) {
      case EIP155_SIGNING_METHODS.PERSONAL_SIGN:
      case EIP155_SIGNING_METHODS.ETH_SIGN: {
        const message = getSignParamsMessage(request.params);
        if (!message) {
          throw new WalletError(WalletErrorType.SIGNING_FAILED, 'Message is empty');
        }

        let signedMessage: string;
        if (wallet.type === WalletType.SATOCHIP) {

          // compute hash
          const messageBytes = ethers.utils.isHexString(message)
            ? ethers.utils.arrayify(message)  // v5: arrayify instead of getBytes
            : ethers.utils.toUtf8Bytes(message);
          const hashHexString = ethers.utils.hashMessage(messageBytes);
          const hashBytes = Buffer.from(hashHexString.slice(2), 'hex');
          // console.log(`approveEIP155RequestEnhanced hashBytes: ${hashBytes.toString('hex')}`);

          // sign hash
          const satochipInfo = (wallet as SatochipWallet).satochipInfo;
          // console.log('approveEIP155RequestEnhanced satochipInfo:', satochipInfo);

          const derSig  = await withModal(
            async () => signWithSatochip(
              card,
              satochipInfo.masterXfp,
              satochipInfo.derivationPath,
              hashBytes,
              pin
            )
          )();
          // console.log(`approveEIP155RequestEnhanced derSig: ${derSig.toString('hex')}`);

          // Step 3: Parse DER signature to get r and s
          const { r, s } = parseDERSignature(derSig);
          // console.log('approveEIP155RequestEnhanced Signature components - r:', r, 's:', s);

          // Step 4: Recover v value
          const txType = 1; // anything except 0, returns a value between 0 and 1
          const v = await recoverVValue(
            hashHexString,
            r,
            s,
            address,
            chainId,
            txType
          );
          // console.log('approveEIP155RequestEnhanced Recovered v value:', v);

          // concatenate values to get signature
          signedMessage = r + s.slice(2) + v.toString(16).padStart(2, '0');
          // console.log('approveEIP155RequestEnhanced signedMessage:', signedMessage);
        } else {
          // software wallet
          signedMessage = await (wallet as ISoftwareWallet).signMessage(message);
          // console.log('approveEIP155RequestEnhanced software wallet address: ', wallet.address);
          // console.log('approveEIP155RequestEnhanced signedMessage:' , signedMessage);
        }

        return formatJsonRpcResult(id, signedMessage);
      }

      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V3:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4: {
        const {domain, types, message: data} = getSignTypedDataParamsData(request.params);
        // console.log(`approveEIP155RequestEnhanced sign_typed_data domain: ${domain}`);
        // console.log(`approveEIP155RequestEnhanced sign_typed_data types: ${types}`);
        // console.log(`approveEIP155RequestEnhanced sign_typed_data message: ${data}`);
        delete types.EIP712Domain;
        
        // For hardware wallets, we might need to serialize the typed data differently
        let signedData;
        if (wallet.type === WalletType.SATOCHIP) {

          // Step 1: Compute unsigned typedData hash
          const hashHexString = ethers.utils._TypedDataEncoder.hash(domain, types, data);
          const hashBytes = Buffer.from(hashHexString.slice(2), 'hex');
          // console.log(`approveEIP155RequestEnhanced hashBytes: ${hashBytes.toString('hex')}`);

          // sign hash
          const satochipInfo = (wallet as SatochipWallet).satochipInfo;
          // console.log('approveEIP155RequestEnhanced satochipInfo:', satochipInfo);
          const derSig  = await withModal(
            async () => signWithSatochip(
              card,
              satochipInfo.masterXfp,
              satochipInfo.derivationPath,
              hashBytes,
              pin
            )
          )();
          // console.log(`approveEIP155RequestEnhanced derSig: ${derSig.toString('hex')}`);

          // Step 3: Parse DER signature to get r and s
          const { r, s } = parseDERSignature(derSig);
          // console.log('approveEIP155RequestEnhanced Signature components - r:', r, 's:', s);

          // Step 4: Recover v value
          const txType = 1; // anything except 0, returns a value between 0 and 1
          const v = await recoverVValue(
            hashHexString,
            r,
            s,
            address,
            chainId,
            txType
          );
          // console.log('approveEIP155RequestEnhanced Recovered v value:', v);

          // concatenate values to get signature
          signedData = r + s.slice(2) + v.toString(16).padStart(2, '0');
          // console.log('approveEIP155RequestEnhanced signedMessage:', signedData);

        } else {
          // Software wallets can handle typed data directly
          signedData = await (wallet as ISoftwareWallet).signTypedData(domain, types, data);
        }

        return formatJsonRpcResult(id, signedData);
      }

      case EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TRANSACTION: {
        const transaction = request.params[0];
        // console.log(`Signing transaction: ${transaction}`);
        
        // For hardware wallets, we might need to prepare the transaction hash
        let signedTx;
        if (wallet.type === WalletType.SATOCHIP) {

          // Step 1: Compute unsigned transaction hash
          const { hash: unsignedHash, unsignedTx } = computeUnsignedTransactionHash(
            transaction,
            chainId
          );
          const unsignedHashBytes = Buffer.from(unsignedHash.slice(2), 'hex');
          // console.log('approveEIP155RequestEnhanced unsignedHashBytes:', unsignedHashBytes.toString('hex'));

          // Hardware wallets typically sign transaction hashes
          // const txHash = hashTransaction(transaction, chainId);
          // const hash = Buffer.from(txHash.slice(2), 'hex');
          // console.log('approveEIP155RequestEnhanced hash:', hash.toString('hex'));

          const satochipInfo = (wallet as SatochipWallet).satochipInfo;
          // console.log('approveEIP155RequestEnhanced satochipInfo:', satochipInfo);

          const derSig  = await withModal(
            async () => signWithSatochip(
              card,
              satochipInfo.masterXfp,
              satochipInfo.derivationPath,
              unsignedHashBytes,
              pin
            )
          )();
          // console.log(`approveEIP155RequestEnhanced derSig: ${derSig.toString('hex')}`);

          // Step 3: Parse DER signature to get r and s
          const { r, s } = parseDERSignature(derSig);
          // console.log('approveEIP155RequestEnhanced Signature components - r:', r, 's:', s);

          // Step 4: Recover v value
          const txType = getTransactionType(transaction);
          const v = await recoverVValue(
            unsignedHash,
            r,
            s,
            address,
            chainId,
            txType
          );
          // console.log('approveEIP155RequestEnhanced Recovered v value:', v);

          // Step 5: Create signed transaction
          signedTx = createSignedTransaction(unsignedTx, r, s, v, chainId);
          // console.log('approveEIP155RequestEnhanced signedTx:', signedTx);

        } else {
          // Software wallets can handle full transaction objects
          signedTx = await (wallet as ISoftwareWallet).signTransaction(transaction);
        }

        // Return signedTx or txHash based on method type
        if (request.method === EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION) {
          // Broadcast and return transaction hash
          const txHash = await broadcastTransaction(signedTx, chainId);
          console.log('approveEIP155RequestEnhanced txHash:', txHash);
          return formatJsonRpcResult(id, txHash);
        } else {
          // Return signed transaction for eth_signTransaction
          return formatJsonRpcResult(id, signedTx);
        }

      }

      default:
        throw new WalletError(
          WalletErrorType.UNSUPPORTED_OPERATION,
          `Unsupported method: ${request.method}`
        );
    }
  } catch (error: any) {
    console.error('Error in enhanced EIP155 request handler:', error);

    // todo handle card error?
    // Handle specific wallet errors
    if (error instanceof WalletError) {
      switch (error.type) {
        case WalletErrorType.AUTHENTICATION_FAILED:
          return formatJsonRpcError(id, 'Hardware wallet authentication required');
        case WalletErrorType.DEVICE_NOT_FOUND:
          return formatJsonRpcError(id, 'Wallet not found or not connected');
        case WalletErrorType.PIN_BLOCKED:
          return formatJsonRpcError(id, 'Hardware wallet PIN is blocked');
        case WalletErrorType.INVALID_PIN:
          return formatJsonRpcError(id, error.message);
        default:
          return formatJsonRpcError(id, error.message);
      }
    }
    
    return formatJsonRpcError(id, error?.message || 'Unknown error occurred');
  } finally {
    if (wallet && wallet.type === WalletType.SATOCHIP) {
      closeNfc();
      await card.endNfcSession();
    }
  }
}

/**
 * Enhanced reject function
 */
export function rejectEIP155RequestEnhanced(request: RequestEventArgs) {
  const {id} = request;
  return formatJsonRpcError(id, getSdkError('USER_REJECTED').message);
}

// /**
//  * Hash EIP155 transaction
//  */
// function hashTransaction(txData: any, chainId: number): string {
//
//   // Format transaction for ethers
//   const unsignedTx = {
//     to: txData.to,
//     nonce: txData.nonce,
//     gasLimit: txData.gas,
//     gasPrice: txData.gasPrice,
//     value: txData.value,
//     data: txData.data || "0x",
//     chainId: chainId // Mainnet - adjust as needed
//   };
//
//   // Serialize the transaction
//   const serialized = ethers.utils.serializeTransaction(unsignedTx);
//
//   // Hash the serialized transaction
//   const hash = ethers.utils.keccak256(serialized); // string in "0x..." format
//   console.log("Transaction hash to sign:", hash);
//
//   return hash;
// }

function extractChainId(caip2: string): number {
  const parts = caip2.split(':');
  if (parts.length !== 2 || parts[0] !== 'eip155') {
    throw new Error(`Invalid CAIP-2 identifier: ${caip2}`);
  }
  return parseInt(parts[1], 10);
}

/**
 * Compute unsigned transaction hash using ethers v5 (simplified)
 */
function computeUnsignedTransactionHash(
  transaction: TransactionRequest,
  chainId: number
): { hash: string; unsignedTx: any } {
  const txType = getTransactionType(transaction);

  // Prepare transaction object
  const txData: any = {
    type: txType,
    chainId: chainId,
    nonce: transaction.nonce ?
      ethers.utils.hexValue(ethers.BigNumber.from(transaction.nonce)) : '0x0',
    to: transaction.to || null,
    value: transaction.value ?
      ethers.utils.hexValue(ethers.BigNumber.from(transaction.value)) : '0x0',
    data: transaction.data || '0x',
    gasLimit: transaction.gas || transaction.gasLimit ?
      ethers.utils.hexValue(ethers.BigNumber.from(transaction.gas || transaction.gasLimit)) : '0x5208',
  };

  // Add type-specific fields
  if (txType === 2) {
    // EIP-1559
    txData.maxFeePerGas = ethers.utils.hexValue(ethers.BigNumber.from(transaction.maxFeePerGas));
    txData.maxPriorityFeePerGas = ethers.utils.hexValue(ethers.BigNumber.from(transaction.maxPriorityFeePerGas));
  } else {
    // Legacy
    txData.gasPrice = transaction.gasPrice ?
      ethers.utils.hexValue(ethers.BigNumber.from(transaction.gasPrice)) : '0x0';
  }

  // Get the unsigned serialized transaction for hashing
  // This will throw if the transaction format is invalid
  const unsignedSerialized = ethers.utils.serializeTransaction(txData);

  // Get the hash that should be signed
  // For legacy transactions, this includes EIP-155 encoding
  const signatureHash = ethers.utils.keccak256(unsignedSerialized);

  return {
    hash: signatureHash,
    unsignedTx: txData
  };
}

/**
 * Create and serialize signed transaction
 */
function createSignedTransaction(
  unsignedTx: any,
  r: string,
  s: string,
  v: number,
  chainId: number
): string {
  const txType = unsignedTx.type || 0;

  // Prepare transaction data WITHOUT signature
  const txData: any = {
    type: txType,
    chainId: chainId,
    nonce: unsignedTx.nonce,
    to: unsignedTx.to,
    value: unsignedTx.value,
    data: unsignedTx.data,
    gasLimit: unsignedTx.gasLimit,
  };

  if (txType === 2) {
    // EIP-1559
    txData.maxFeePerGas = unsignedTx.maxFeePerGas;
    txData.maxPriorityFeePerGas = unsignedTx.maxPriorityFeePerGas;
  } else {
    // Legacy
    txData.gasPrice = unsignedTx.gasPrice;
  }

  // Serialize the transaction WITH signature passed as second parameter
  const serializedTx = ethers.utils.serializeTransaction(txData, { r, s, v });
  // console.log(`enhancedEIP155RequestHandler createSignedTransaction serializedTx: ${serializedTx}`);

  return serializedTx;
}

/**
 * Broadcast transaction to the network with automatic provider selection
 */
async function broadcastTransaction(
  signedTx: string,
  chainId: number,
  customRpcUrl?: string
): Promise<string> {
  try {
    // If custom RPC URL is provided, use it first
    if (customRpcUrl) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(customRpcUrl);
        const txResponse = await provider.sendTransaction(signedTx);
        return txResponse.hash;
      } catch (error) {
        console.warn(`broadcastTransaction Custom RPC failed, falling back to public endpoints:`, error.message);
      }
    }

    // Get all public RPC URLs for the chain
    const rpcUrls = getPublicRpcUrls(chainId);

    if (!rpcUrls || rpcUrls.length === 0) {
      throw new Error(`No RPC URLs configured for chainId ${chainId}`);
    }

    // Try multiple endpoints with fallback
    return await tryMultipleRpcEndpoints(signedTx, rpcUrls);

  } catch (error) {
    console.error('Error broadcasting transaction:', error);
    throw error;
  }
}

/**
 * Try multiple RPC endpoints with fallback
 */
async function tryMultipleRpcEndpoints(
  signedTx: string,
  rpcUrls: string[]
): Promise<string> {
  let lastError: any;

  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`Trying RPC endpoint: ${rpcUrl}`);
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

      // Set a timeout for the provider
      provider.connection.timeout = 10000; // 10 seconds

      const txResponse = await provider.sendTransaction(signedTx);
      console.log(`Successfully broadcast transaction via ${rpcUrl}`);
      return txResponse.hash;
    } catch (error) {
      console.warn(`Failed to broadcast via ${rpcUrl}:`, error.message);
      lastError = error;
      // Continue to next RPC endpoint
    }
  }

  // If all endpoints failed, throw the last error
  throw new Error(`Failed to broadcast transaction on all endpoints. Last error: ${lastError?.message}`);
}

/**
 * Get public RPC URL for a given chainId (no API key required)
 */
function getPublicRpcUrls(chainId: number): string[] {

  const urls = EIP155_RPCS_BY_CHAINS[chainId];
  if (!urls || urls.length === 0) {
    throw new Error(`No public RPC URL available for chainId ${chainId}`);
  }

  // Return the first URL, but you could implement random selection or fallback logic
  return urls;
}

/**
 * Parse DER encoded signature to extract r and s components
 */
function parseDERSignature(derBuffer: Buffer): { r: string, s: string } {
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
  const rPadded = Buffer.concat([Buffer.alloc(Math.max(0, 32 - r.length)), r].slice(-32));
  const sPadded = Buffer.concat([Buffer.alloc(Math.max(0, 32 - s.length)), s].slice(-32));

  return {
    r: '0x' + rPadded.toString('hex'),
    s: '0x' + sPadded.toString('hex')
  };
}

function enforceLowS(sBytes: Buffer): Buffer {
  const CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  const HALF_CURVE_ORDER = CURVE_ORDER / 2n;

  let s = BigInt('0x' + sBytes.toString('hex'));

  if (s > HALF_CURVE_ORDER) {
    s = CURVE_ORDER - s;
  }

  const hex = s.toString(16).padStart(64, '0');

  return Buffer.from(hex, 'hex');
}


/**
 * Determine transaction type based on parameters
 */
function getTransactionType(tx: TransactionRequest): number {
  if (tx.maxFeePerGas !== undefined && tx.maxPriorityFeePerGas !== undefined) {
    return 2; // EIP-1559
  }
  return 0; // Legacy
}

/**
 * Recover v value from signature components
 */
async function recoverVValue(
  messageHash: string,
  r: string,
  s: string,
  expectedAddress: string,
  chainId: number,
  txType: number
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
      const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);

      if (recoveredAddress.toLowerCase() === address) {
        return v;
      }
    } catch (e) {
      // Try next recovery value
    }
  }

  throw new Error('Could not recover correct v value from signature');
}
