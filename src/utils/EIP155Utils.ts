import { ethers } from 'ethers';
import { EIP155_RPCS_BY_CHAINS } from '@/constants/Eip155';

// Transaction type definitions
export interface TransactionRequest {
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
 * Validate an Ethereum address
 *
 * @param address - Address to validate
 * @param senderAddress - Optional sender address (to prevent sending to self)
 * @returns Error message if invalid, null if valid
 */
export function validateAddress(address: string, senderAddress?: string): string | null {
  if (!address || address.trim() === '') {
    return 'Address is required';
  }

  if (!ethers.utils.isAddress(address)) {
    return 'Invalid Ethereum address format';
  }

  if (senderAddress && address.toLowerCase() === senderAddress.toLowerCase()) {
    return 'Cannot send to yourself';
  }

  return null;
}

/**
 * Validate transaction amount
 *
 * @param amount - Amount to send (in Ether, string)
 * @param balance - Current balance (in Ether, string)
 * @param gasCost - Estimated gas cost (in Ether, string)
 * @returns Error message if invalid, null if valid
 */
export function validateAmount(amount: string, balance: string, gasCost: string): string | null {
  if (!amount || amount.trim() === '') {
    return 'Amount is required';
  }

  // Check if amount is a valid number
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum)) {
    return 'Invalid amount format';
  }

  if (amountNum <= 0) {
    return 'Amount must be greater than zero';
  }

  // Check if amount has too many decimal places (max 18 for Ethereum)
  const decimalParts = amount.split('.');
  if (decimalParts.length === 2 && decimalParts[1].length > 18) {
    return 'Amount has too many decimal places (max 18)';
  }

  try {
    const amountBN = ethers.utils.parseEther(amount);
    const balanceBN = ethers.utils.parseEther(balance);
    const gasCostBN = ethers.utils.parseEther(gasCost);
    const totalCostBN = amountBN.add(gasCostBN);

    if (totalCostBN.gt(balanceBN)) {
      return 'Insufficient balance (including gas fees)';
    }
  } catch (error) {
    return 'Invalid amount value';
  }

  return null;
}

/**
 * Calculate maximum sendable amount (balance - gas cost)
 *
 * @param balance - Current balance in Wei (string)
 * @param gasEstimate - Gas limit in hex or decimal string
 * @param gasPrice - Gas price in Wei (hex or decimal string)
 * @returns Maximum amount in Ether (string), or '0' if insufficient for gas
 */
export function calculateMaxAmount(
  balance: string,
  gasEstimate: string,
  gasPrice: string
): string {
  try {
    const balanceBN = ethers.BigNumber.from(balance);
    const gasLimitBN = ethers.BigNumber.from(gasEstimate);
    const gasPriceBN = ethers.BigNumber.from(gasPrice);
    const gasCostBN = gasLimitBN.mul(gasPriceBN);

    // Check if balance can cover gas cost
    if (balanceBN.lte(gasCostBN)) {
      return '0';
    }

    const maxAmountBN = balanceBN.sub(gasCostBN);
    return ethers.utils.formatEther(maxAmountBN);
  } catch (error: unknown) {
    console.error('[EIP155Utils] Error calculating max amount:', error);
    return '0';
  }
}

/**
 * Parse amount string to Wei (BigNumber)
 *
 * @param amount - Amount in Ether (string)
 * @returns Amount in Wei as BigNumber
 * @throws Error if amount format is invalid
 */
export function parseAmountToWei(amount: string): ethers.BigNumber {
  try {
    return ethers.utils.parseEther(amount);
  } catch (error) {
    throw new Error(`Invalid amount format: ${amount}`);
  }
}

/**
 * Format gas cost from Wei to Ether with appropriate precision
 *
 * @param gasLimit - Gas limit in hex or decimal string
 * @param gasPrice - Gas price in Wei (hex or decimal string)
 * @returns Gas cost in Ether (string)
 */
export function formatGasCost(gasLimit: string, gasPrice: string): string {
  try {
    const gasLimitBN = ethers.BigNumber.from(gasLimit);
    const gasPriceBN = ethers.BigNumber.from(gasPrice);
    const gasCostBN = gasLimitBN.mul(gasPriceBN);
    return ethers.utils.formatEther(gasCostBN);
  } catch (error: unknown) {
    console.error('[EIP155Utils] Error formatting gas cost:', error);
    return '0';
  }
}

/**
 * Get block explorer URL for a transaction
 *
 * @param chainId - Chain ID
 * @param txHash - Transaction hash
 * @returns Block explorer URL
 */
export function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    5: 'https://goerli.etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    80001: 'https://mumbai.polygonscan.com',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    42161: 'https://arbiscan.io',
    421614: 'https://sepolia.arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    11155420: 'https://sepolia-optimism.etherscan.io',
    43114: 'https://snowtrace.io',
    43113: 'https://testnet.snowtrace.io',
    250: 'https://ftmscan.com',
    8453: 'https://basescan.org',
    84532: 'https://sepolia.basescan.org',
    100: 'https://gnosisscan.io',
    324: 'https://explorer.zksync.io',
    42220: 'https://celoscan.io',
  };

  const baseUrl = explorers[chainId] || 'https://etherscan.io';
  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Extract numeric chain ID from CAIP-2 format (e.g., "eip155:1" -> 1)
 *
 * @param caip2 - CAIP-2 chain identifier (e.g., "eip155:1")
 * @returns Numeric chain ID
 */
export function extractChainId(caip2: string): number {
  const parts = caip2.split(':');
  if (parts.length !== 2 || parts[0] !== 'eip155') {
    throw new Error(`Invalid CAIP-2 identifier: ${caip2}`);
  }
  return parseInt(parts[1], 10);
}

/**
 * Compute unsigned transaction hash using ethers v5
 * Handles both legacy and EIP-1559 transactions
 *
 * @param transaction - Transaction request object
 * @param chainId - Chain ID for EIP-155
 * @returns Object containing hash and unsigned transaction object
 */
export function computeUnsignedTransactionHash(
  transaction: TransactionRequest,
  chainId: number,
): { hash: string; unsignedTx: any } {
  const txType = getTransactionType(transaction);

  // Prepare transaction object
  const txData: any = {
    type: txType,
    chainId: chainId,
    nonce: transaction.nonce
      ? ethers.utils.hexValue(ethers.BigNumber.from(transaction.nonce))
      : '0x0',
    to: transaction.to || null,
    value: transaction.value
      ? ethers.utils.hexValue(ethers.BigNumber.from(transaction.value))
      : '0x0',
    data: transaction.data || '0x',
    gasLimit:
      transaction.gas || transaction.gasLimit
        ? ethers.utils.hexValue(
            ethers.BigNumber.from(transaction.gas || transaction.gasLimit),
          )
        : '0x5208',
  };

  // Add type-specific fields
  if (txType === 2) {
    // EIP-1559
    txData.maxFeePerGas = ethers.utils.hexValue(
      ethers.BigNumber.from(transaction.maxFeePerGas),
    );
    txData.maxPriorityFeePerGas = ethers.utils.hexValue(
      ethers.BigNumber.from(transaction.maxPriorityFeePerGas),
    );
  } else {
    // Legacy
    txData.gasPrice = transaction.gasPrice
      ? ethers.utils.hexValue(ethers.BigNumber.from(transaction.gasPrice))
      : '0x0';
  }

  // Get the unsigned serialized transaction for hashing
  // This will throw if the transaction format is invalid
  const unsignedSerialized = ethers.utils.serializeTransaction(txData);

  // Get the hash that should be signed
  // For legacy transactions, this includes EIP-155 encoding
  const signatureHash = ethers.utils.keccak256(unsignedSerialized);

  return {
    hash: signatureHash,
    unsignedTx: txData,
  };
}

/**
 * Create and serialize signed transaction
 *
 * @param unsignedTx - Unsigned transaction object
 * @param r - R component of signature (0x prefixed hex string)
 * @param s - S component of signature (0x prefixed hex string)
 * @param v - V value (recovery parameter)
 * @param chainId - Chain ID
 * @returns Serialized signed transaction (0x prefixed hex string)
 */
export function createSignedTransaction(
  unsignedTx: any,
  r: string,
  s: string,
  v: number,
  chainId: number,
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

  return serializedTx;
}

/**
 * Determine transaction type based on parameters
 *
 * @param tx - Transaction request object
 * @returns Transaction type (0 = legacy, 2 = EIP-1559)
 */
export function getTransactionType(tx: TransactionRequest): number {
  if (
    tx.maxFeePerGas !== undefined &&
    tx.maxPriorityFeePerGas !== undefined
  ) {
    return 2; // EIP-1559
  }
  return 0; // Legacy
}

/**
 * Broadcast transaction to the network with automatic provider selection
 * Tries custom RPC first, then falls back to public endpoints
 *
 * @param signedTx - Serialized signed transaction (0x prefixed hex string)
 * @param chainId - Chain ID
 * @param customRpcUrl - Optional custom RPC URL to try first
 * @returns Transaction hash
 */
export async function broadcastTransaction(
  signedTx: string,
  chainId: number,
  customRpcUrl?: string,
): Promise<string> {
  try {
    // If custom RPC URL is provided, use it first
    if (customRpcUrl) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(customRpcUrl);
        const txResponse = await provider.sendTransaction(signedTx);
        return txResponse.hash;
      } catch (error: any) {
        console.warn(
          `broadcastTransaction Custom RPC failed, falling back to public endpoints:`,
          error.message,
        );
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
 *
 * @param signedTx - Serialized signed transaction
 * @param rpcUrls - Array of RPC URLs to try
 * @returns Transaction hash from successful broadcast
 */
export async function tryMultipleRpcEndpoints(
  signedTx: string,
  rpcUrls: string[],
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
    } catch (error: any) {
      console.warn(`Failed to broadcast via ${rpcUrl}:`, error.message);
      lastError = error;
      // Continue to next RPC endpoint
    }
  }

  // If all endpoints failed, throw the last error
  throw new Error(
    `Failed to broadcast transaction on all endpoints. Last error: ${lastError?.message}`,
  );
}

/**
 * Get public RPC URLs for a given chainId
 *
 * @param chainId - Chain ID
 * @returns Array of RPC URLs
 */
export function getPublicRpcUrls(chainId: number): string[] {
  const urls = EIP155_RPCS_BY_CHAINS[chainId];
  if (!urls || urls.length === 0) {
    throw new Error(`No public RPC URL available for chainId ${chainId}`);
  }

  return urls;
}
