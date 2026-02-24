import {utils} from 'ethers';
import {ProposalTypes} from '@walletconnect/types';
import {PresetsUtil} from './PresetsUtil';
import {WalletError, WalletErrorType} from '@/types/WalletTypes';
import TransactionService from '@/services/TransactionService.ts';

/**
 * Truncates string (in the middle) via given length value
 */
export function truncate(value: string, length: number) {
  if (value?.length <= length) {
    return value;
  }

  const separator = '...';
  const stringLength = length - separator.length;
  const frontLength = Math.ceil(stringLength / 2);
  const backLength = Math.floor(stringLength / 2);

  return (
    value.substring(0, frontLength) +
    separator +
    value.substring(value.length - backLength)
  );
}

/**
 * Converts hex to utf8 string if it is valid bytes
 */
export function convertHexToUtf8(value: string) {
  if (utils.isHexString(value)) {
    return utils.toUtf8String(value);
  }

  return value;
}

/**
 * Gets message from various signing request methods by filtering out
 * a value that is not an address (thus is a message).
 * If it is a hex string, it gets converted to utf8 string
 */
export function getSignParamsMessage(params: string[]) {
  const message = params.filter(p => !utils.isAddress(p))[0];

  return convertHexToUtf8(message);
}

/**
 * Gets data from various signTypedData request methods by filtering out
 * a value that is not an address (thus is data).
 * If data is a string convert it to object
 */
export function getSignTypedDataParamsData(params: string[]) {
  const data = params.filter(p => !utils.isAddress(p))[0];

  return JSON.parse(data);
}

/**
 * Validates and normalizes a single Ethereum address
 * @param address - The address to validate
 * @returns Checksummed address
 * @throws WalletError if address is invalid
 */
export function validateAndNormalizeAddress(address: any): string {
  // Check for null/undefined
  if (address === null || address === undefined) {
    throw new WalletError(
      WalletErrorType.INVALID_ADDRESS,
      'Address is null or undefined',
    );
  }

  // Check for non-string types
  if (typeof address !== 'string') {
    throw new WalletError(
      WalletErrorType.INVALID_ADDRESS,
      `Address must be a string, got ${typeof address}`,
    );
  }

  // Check for empty string
  if (address.trim() === '') {
    throw new WalletError(
      WalletErrorType.INVALID_ADDRESS,
      'Address is empty',
    );
  }

  // Validate and normalize using ethers
  try {
    // getAddress() validates format AND returns checksummed version
    return utils.getAddress(address);
  } catch (error) {
    throw new WalletError(
      WalletErrorType.INVALID_ADDRESS,
      `Address has invalid format: ${address}`,
      error as Error,
    );
  }
}

/**
 * Validates transaction object
 * @param transaction - The transaction object
 * @param chainId
 * @returns Transaction - validated and complete
 * @throws WalletError if transaction or from address is invalid
 */
export async function validateTransaction(
  transaction: any,
  chainId: number,
): Promise<any> {
  if (!transaction || typeof transaction !== 'object') {
    throw new WalletError(
      WalletErrorType.INVALID_ADDRESS,
      'Transaction must be an object',
    );
  }

  // Validate 'from' address (required)
  if (!transaction.from) {
    throw new WalletError(
      WalletErrorType.INVALID_ADDRESS,
      'Transaction missing "from" address',
    );
  }
  const normalizedFrom = validateAndNormalizeAddress(transaction.from);

  // Validate 'to' address (optional for contract creation)
  let normalizedTo = transaction.to;
  if (transaction.to) {
    normalizedTo = validateAndNormalizeAddress(transaction.to);
  }

  // validate nonce
  let nonce = transaction.nonce;
  if (!nonce) {
    nonce = await TransactionService.fetchNonce(normalizedFrom, chainId);
    console.log(`[HelperUtil] validateTransaction fetched missing nonce: ${nonce}`);
  }

  // validate gasLimit
  let gas = transaction.gas;
  if (!gas){
    gas = await TransactionService.estimateGas(
      normalizedFrom,
      normalizedTo,
      transaction.value,
      transaction.data || '0x',
      chainId
    );
    console.log(`[HelperUtil] validateTransaction estimated missing gas: ${gas}`);
  }

  // validate gas fee (legacy or EIP-1559
  if (!transaction.gasPrice && !(transaction.maxFeePerGas && transaction.maxPriorityFeePerGas)) {
    const gasPriceResult = await TransactionService.fetchGasPrice(chainId);
    if (gasPriceResult.maxFeePerGas && gasPriceResult.maxPriorityFeePerGas) {
      let maxFeePerGas = transaction.maxFeePerGas;
      if (!maxFeePerGas){
        maxFeePerGas = gasPriceResult.maxFeePerGas;
        console.log(`[HelperUtil] validateTransaction estimated missing maxFeePerGas: ${maxFeePerGas}`);
      }
      let maxPriorityFeePerGas = transaction.maxPriorityFeePerGas;
      if (!maxPriorityFeePerGas){
        maxPriorityFeePerGas = gasPriceResult.maxPriorityFeePerGas;
        console.log(`[HelperUtil] validateTransaction estimated missing maxPriorityFeePerGas: ${maxPriorityFeePerGas}`);
      }
      return {
        ...transaction,
        from: normalizedFrom,
        to: normalizedTo,
        nonce: nonce,
        gas: gas,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      };
    } else if (gasPriceResult.legacy) {
      console.log(`[HelperUtil] validateTransaction estimated missing gasPrice: ${gasPriceResult.legacy}`);
      return {
        ...transaction,
        from: normalizedFrom,
        to: normalizedTo,
        nonce: nonce,
        gas: gas,
        gasPrice: gasPriceResult.legacy,
      }
    }else {
      throw new WalletError(
        WalletErrorType.INVALID_GAS_FEE,
        'Transaction missing gas info',
      )
    }
  }

  // Return transaction with nonce
  return {
    ...transaction,
    from: normalizedFrom,
    to: normalizedTo,
    nonce: nonce,
    gas: gas,
  };
}

/**
 * Extract and validate addresses from WalletConnect params
 * @param params - WalletConnect request params
 * @returns Checksummed address
 * @throws WalletError if address is invalid
 */
export function getEIP155AddressesFromParams(params: any): string {
  const method = params.request.method;

  try {
    switch (method) {
      case "eth_sign": {
        const address = params.request.params[0];
        return validateAndNormalizeAddress(address);
      }

      case "personal_sign": {
        const address = params.request.params[1];
        return validateAndNormalizeAddress(address);
      }

      case "eth_signTypedData":
      case "eth_signTypedData_V3":
      case "eth_signTypedData_v4": {
        const address = params.request.params[0];
        return validateAndNormalizeAddress(address);
      }

      case "eth_signTransaction":
      case "eth_sendTransaction": {
        const transaction = params.request.params[0];
        if (!transaction || typeof transaction !== 'object') {
          throw new WalletError(
            WalletErrorType.INVALID_ADDRESS,
            'Transaction must be an object',
          );
        }
        // Validate transaction addresses
        return validateAndNormalizeAddress(transaction.from); // Return normalized 'from' address
      }

      default:
        throw new WalletError(
          WalletErrorType.UNSUPPORTED_OPERATION,
          `Unsupported method: ${method}`,
        );
    }
  } catch (error) {
    // Re-throw WalletError as-is
    if (error instanceof WalletError) {
      throw error;
    }
    // Wrap unexpected errors
    throw new WalletError(
      WalletErrorType.INVALID_ADDRESS,
      `Failed to extract address from ${method}: ${error}`,
      error as Error,
    );
  }
}

/**
 * Get Wallet supported chains
 */
export function getSupportedChains(
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  optionalNamespaces: ProposalTypes.OptionalNamespaces,
) {
  if (!requiredNamespaces && !optionalNamespaces) {
    return [];
  }

  const required = [];
  for (const [key, values] of Object.entries(requiredNamespaces)) {
    const chains = key.includes(':') ? key : values.chains;
    if (chains) {
      required.push(chains);
    }
  }

  const optional = [];
  for (const [key, values] of Object.entries(optionalNamespaces)) {
    const chains = key.includes(':') ? key : values.chains;
    if (chains) {
      optional.push(chains);
    }
  }

  const chains = [...required.flat(), ...optional.flat()];

  return chains
    .map(chain => PresetsUtil.getChainData(chain))
    .filter(chain => chain !== undefined);
}
