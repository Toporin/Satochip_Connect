import { ethers } from 'ethers';

/**
 * Format a balance value from Wei to a human-readable string
 *
 * @param balance - Balance in Wei as string
 * @param decimals - Number of decimals (typically 18 for EVM chains)
 * @param maxDecimals - Maximum number of decimal places to show (default: 6)
 * @returns Formatted balance string with commas
 */
export function formatBalance(balance: string, decimals: number = 18, maxDecimals: number = 6): string {
  try {
    // Convert from Wei to human-readable format
    const formatted = ethers.utils.formatUnits(balance, decimals);

    // Parse as a number
    const num = parseFloat(formatted);

    // If balance is 0, return "0"
    if (num === 0) {
      return '0';
    }

    // If balance is very small, show in scientific notation
    if (num < 0.000001) {
      return num.toExponential(2);
    }

    // If balance is less than 0.01, show more decimals
    if (num < 0.01) {
      return num.toFixed(6);
    }

    // Otherwise, format with appropriate decimals
    const decimalsToShow = Math.min(maxDecimals, 6);
    const rounded = parseFloat(num.toFixed(decimalsToShow));

    // Add commas for thousands separators
    return rounded.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalsToShow,
    });
  } catch (error) {
    console.error('[formatters] Error formatting balance:', error);
    return '0';
  }
}

/**
 * Format a USD value
 *
 * @param value - USD value as number
 * @param showCents - Whether to show cents (default: true)
 * @returns Formatted USD string (e.g., "$1,234.56")
 */
export function formatUSD(value: number, showCents: boolean = true): string {
  try {
    if (value === 0) {
      return '$0.00';
    }

    // If value is very small, show with more precision
    if (value < 0.01) {
      return `$${value.toFixed(4)}`;
    }

    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  } catch (error) {
    console.error('[formatters] Error formatting USD:', error);
    return '$0.00';
  }
}

/**
 * Truncate an address for display (e.g., "0x1234...5678")
 *
 * @param address - Full address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address
 */
export function truncateAddress(address: string, startChars: number = 6, endChars: number = 6): string {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Calculate USD value from balance and price
 *
 * @param balance - Balance in Wei as string
 * @param decimals - Number of decimals (typically 18 for EVM chains)
 * @param priceUSD - Price per token in USD
 * @returns USD value as number
 */
export function calculateUSDValue(balance: string, decimals: number, priceUSD: number): number {
  try {
    const formatted = ethers.utils.formatUnits(balance, decimals);
    const num = parseFloat(formatted);
    return num * priceUSD;
  } catch (error) {
    console.error('[formatters] Error calculating USD value:', error);
    return 0;
  }
}

/**
 * Check if a balance is zero
 *
 * @param balance - Balance in Wei as string
 * @returns True if balance is zero
 */
export function isZeroBalance(balance: string): boolean {
  try {
    const bn = ethers.BigNumber.from(balance);
    return bn.isZero();
  } catch {
    return true;
  }
}
