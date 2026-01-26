import { ethers } from 'ethers';
import { EIP155_RPCS_BY_CHAINS, EIP155_CHAINS } from '@/constants/Eip155';

export interface BuildTransactionParams {
  from: string;
  to: string;
  value: string; // in hex
  chainId: number;
  nonce: number;
  gasLimit: string; // in hex
  gasPrice?: string; // in hex (legacy)
  maxFeePerGas?: string; // in hex (EIP-1559)
  maxPriorityFeePerGas?: string; // in hex (EIP-1559)
  data?: string; // hex data (default '0x' for simple transfer)
}

export interface GasPriceResult {
  legacy?: string; // gasPrice in hex (for legacy transactions)
  maxFeePerGas?: string; // in hex (EIP-1559)
  maxPriorityFeePerGas?: string; // in hex (EIP-1559)
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * TransactionService - Singleton service for blockchain transaction operations
 *
 * Features:
 * - Nonce fetching with RPC failover
 * - Gas estimation with 10% buffer and fallback
 * - Gas price fetching (legacy and EIP-1559)
 * - Transaction building and validation
 * - Multi-RPC fallback for reliability
 */
class TransactionService {
  private static instance: TransactionService;

  private constructor() {}

  static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Fetch nonce for an address from blockchain
   * CRITICAL: Uses 'pending' parameter to get next available nonce
   *
   * @param address - Ethereum address
   * @param chainId - Chain ID
   * @param pending - Use pending transactions (default true)
   * @returns Next available nonce
   */
  async fetchNonce(
    address: string,
    chainId: number,
    pending: boolean = true
  ): Promise<number> {
    const rpcUrls = EIP155_RPCS_BY_CHAINS[chainId];

    if (!rpcUrls || rpcUrls.length === 0) {
      throw new Error(`No RPC URLs configured for chain ${chainId}`);
    }

    // Try each RPC URL until one succeeds
    for (let i = 0; i < rpcUrls.length; i++) {
      const rpcUrl = rpcUrls[i];
      try {
        console.log(`[TransactionService] Fetching nonce for ${address} on chain ${chainId}`);

        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Set 10-second timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('RPC request timeout')), 10000);
        });

        const noncePromise = provider.getTransactionCount(
          address,
          pending ? 'pending' : 'latest'
        );
        const nonce = await Promise.race([noncePromise, timeoutPromise]);

        console.log(`[TransactionService] Fetched nonce: ${nonce}`);
        return nonce;
      } catch (error) {
        console.warn(`[TransactionService] RPC ${rpcUrl} failed for nonce:`, error);

        // If this was the last RPC URL, throw error
        if (i === rpcUrls.length - 1) {
          throw new Error(`Failed to fetch nonce: All RPC endpoints failed for chain ${chainId}`);
        }

        console.log(`[TransactionService] Trying next RPC URL for nonce...`);
      }
    }

    throw new Error('Unexpected error fetching nonce');
  }

  /**
   * Estimate gas for a transaction with 10% buffer
   * Falls back to 21000 (standard transfer) if estimation fails
   *
   * @param from - Sender address
   * @param to - Recipient address
   * @param value - Amount in hex
   * @param data - Transaction data (default '0x')
   * @param chainId - Chain ID
   * @returns Gas limit in hex with 10% buffer
   */
  async estimateGas(
    from: string,
    to: string,
    value: string,
    data: string = '0x',
    chainId: number
  ): Promise<string> {
    const rpcUrls = EIP155_RPCS_BY_CHAINS[chainId];

    if (!rpcUrls || rpcUrls.length === 0) {
      console.warn(`[TransactionService] No RPC URLs for chain ${chainId}, using fallback gas`);
      return '0x5208'; // 21000 in hex
    }

    // Try each RPC URL until one succeeds
    for (let i = 0; i < rpcUrls.length; i++) {
      const rpcUrl = rpcUrls[i];
      try {
        console.log(`[TransactionService] Estimating gas for transaction on chain ${chainId}`);

        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Set 10-second timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('RPC request timeout')), 10000);
        });

        const estimatePromise = provider.estimateGas({
          from,
          to,
          value,
          data,
        });

        const gasEstimate = await Promise.race([estimatePromise, timeoutPromise]);

        // Add 10% buffer for safety
        const gasWithBuffer = gasEstimate.mul(110).div(100);

        console.log(
          `[TransactionService] Estimated gas: ${gasEstimate.toString()} (with buffer: ${gasWithBuffer.toString()})`
        );
        return gasWithBuffer.toHexString();
      } catch (error) {
        console.warn(`[TransactionService] RPC ${rpcUrl} failed for gas estimation:`, error);

        // If this was the last RPC URL, use fallback
        if (i === rpcUrls.length - 1) {
          console.warn(
            `[TransactionService] All RPC endpoints failed for gas estimation, using fallback (21000)`
          );
          return '0x5208'; // 21000 in hex (standard transfer)
        }

        console.log(`[TransactionService] Trying next RPC URL for gas estimation...`);
      }
    }

    // Fallback (should never reach here)
    console.warn(`[TransactionService] Unexpected fallback for gas estimation, using 21000`);
    return '0x5208';
  }

  /**
   * Fetch gas prices from blockchain
   * Tries EIP-1559 first (getFeeData), falls back to legacy (getGasPrice)
   *
   * @param chainId - Chain ID
   * @returns Gas price info (legacy OR EIP-1559)
   */
  async fetchGasPrice(chainId: number): Promise<GasPriceResult> {
    const rpcUrls = EIP155_RPCS_BY_CHAINS[chainId];

    if (!rpcUrls || rpcUrls.length === 0) {
      throw new Error(`No RPC URLs configured for chain ${chainId}`);
    }

    // Try each RPC URL until one succeeds
    for (let i = 0; i < rpcUrls.length; i++) {
      const rpcUrl = rpcUrls[i];
      try {
        console.log(`[TransactionService] Fetching gas price for chain ${chainId}`);

        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Set 10-second timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('RPC request timeout')), 10000);
        });

        // Try EIP-1559 first
        try {
          const feeDataPromise = provider.getFeeData();
          const feeData = await Promise.race([feeDataPromise, timeoutPromise]);

          // Check if EIP-1559 is supported (has maxFeePerGas)
          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            console.log(
              `[TransactionService] EIP-1559 gas: maxFee=${feeData.maxFeePerGas.toString()}, maxPriority=${feeData.maxPriorityFeePerGas.toString()}`
            );
            return {
              maxFeePerGas: feeData.maxFeePerGas.toHexString(),
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(),
            };
          }

          // If EIP-1559 not supported but gasPrice available, use legacy
          if (feeData.gasPrice) {
            console.log(`[TransactionService] Legacy gas price: ${feeData.gasPrice.toString()}`);
            return {
              legacy: feeData.gasPrice.toHexString(),
            };
          }
        } catch (eip1559Error) {
          console.log(
            `[TransactionService] EIP-1559 not supported, falling back to legacy gasPrice`
          );
        }

        // Fallback to legacy getGasPrice()
        const gasPricePromise = provider.getGasPrice();
        const gasPrice = await Promise.race([gasPricePromise, timeoutPromise]);

        console.log(`[TransactionService] Legacy gas price: ${gasPrice.toString()}`);
        return {
          legacy: gasPrice.toHexString(),
        };
      } catch (error) {
        console.warn(`[TransactionService] RPC ${rpcUrl} failed for gas price:`, error);

        // If this was the last RPC URL, throw error
        if (i === rpcUrls.length - 1) {
          throw new Error(
            `Failed to fetch gas price: All RPC endpoints failed for chain ${chainId}`
          );
        }

        console.log(`[TransactionService] Trying next RPC URL for gas price...`);
      }
    }

    throw new Error('Unexpected error fetching gas price');
  }

  /**
   * Build a complete transaction object ready for signing
   *
   * @param params - Transaction parameters
   * @returns ethers TransactionRequest object
   */
  buildTransaction(params: BuildTransactionParams): ethers.providers.TransactionRequest {
    const tx: ethers.providers.TransactionRequest = {
      from: params.from,
      to: params.to,
      value: params.value,
      chainId: params.chainId,
      nonce: params.nonce,
      gasLimit: params.gasLimit,
      data: params.data || '0x',
    };

    // Add gas pricing (either legacy OR EIP-1559)
    if (params.maxFeePerGas && params.maxPriorityFeePerGas) {
      // EIP-1559
      tx.maxFeePerGas = params.maxFeePerGas;
      tx.maxPriorityFeePerGas = params.maxPriorityFeePerGas;
      tx.type = 2; // EIP-1559 transaction type
    } else if (params.gasPrice) {
      // Legacy
      tx.gasPrice = params.gasPrice;
      tx.type = 0; // Legacy transaction type
    } else {
      throw new Error('Must provide either gasPrice (legacy) or maxFeePerGas/maxPriorityFeePerGas (EIP-1559)');
    }

    return tx;
  }

  /**
   * Validate transaction parameters
   * Checks: address format, positive amount, sufficient balance
   *
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Amount in Ether (string)
   * @param balance - Current balance in Ether (string)
   * @param gasEstimate - Gas limit in hex or decimal string
   * @param gasPrice - Gas price in hex or decimal string (wei)
   * @returns Validation result with error message if invalid
   */
  validateTransaction(
    from: string,
    to: string,
    amount: string,
    balance: string,
    gasEstimate: string,
    gasPrice: string
  ): ValidationResult {
    try {
      // Validate addresses
      if (!ethers.utils.isAddress(from)) {
        return { valid: false, error: 'Invalid sender address' };
      }

      if (!ethers.utils.isAddress(to)) {
        return { valid: false, error: 'Invalid recipient address' };
      }

      if (from.toLowerCase() === to.toLowerCase()) {
        return { valid: false, error: 'Cannot send to yourself' };
      }

      // Validate amount
      const amountBN = ethers.utils.parseEther(amount);
      if (amountBN.lte(0)) {
        return { valid: false, error: 'Amount must be greater than zero' };
      }

      // Calculate total cost (amount + gas)
      const balanceBN = ethers.utils.parseEther(balance);
      const gasLimitBN = ethers.BigNumber.from(gasEstimate);
      const gasPriceBN = ethers.BigNumber.from(gasPrice);
      const gasCostBN = gasLimitBN.mul(gasPriceBN);
      const totalCostBN = amountBN.add(gasCostBN);

      // Check sufficient balance
      if (totalCostBN.gt(balanceBN)) {
        return {
          valid: false,
          error: `Insufficient balance. Required: ${ethers.utils.formatEther(totalCostBN)} ETH, Available: ${balance} ETH`,
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('[TransactionService] Validation error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Calculate gas cost in Wei
   *
   * @param gasLimit - Gas limit in hex or decimal string
   * @param gasPrice - Gas price in hex or decimal string (wei)
   * @returns Gas cost in Wei as BigNumber
   */
  calculateGasCost(gasLimit: string, gasPrice: string): ethers.BigNumber {
    const gasLimitBN = ethers.BigNumber.from(gasLimit);
    const gasPriceBN = ethers.BigNumber.from(gasPrice);
    return gasLimitBN.mul(gasPriceBN);
  }
}

export default TransactionService.getInstance();
