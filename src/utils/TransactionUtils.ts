import { ethers } from 'ethers';

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
  } catch (error) {
    console.error('[TransactionUtils] Error calculating max amount:', error);
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
  } catch (error) {
    console.error('[TransactionUtils] Error formatting gas cost:', error);
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
