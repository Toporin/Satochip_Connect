import { ethers } from 'ethers';
import { EIP155_RPCS_BY_CHAINS, EIP155_CHAINS } from '@/constants/Eip155';

export interface BalanceEntry {
  balance: string; // in Wei, stored as string
  decimals: number; // usually 18 for EVM chains
  timestamp: number; // Unix timestamp in ms
  chainId: number;
  chainName: string;
  symbol: string;
  usdPrice?: number; // Price per token in USD
  usdValue?: number; // Total value: balance * price
  error?: string; // If fetch failed
}

export interface FetchBalanceParams {
  address: string;
  chainId: number;
}

/**
 * BalanceService - Singleton service for fetching blockchain balances
 *
 * Features:
 * - RPC failover: tries each RPC URL until one succeeds
 * - Concurrent fetching for multiple addresses/chains
 * - Error handling and logging
 */
class BalanceService {
  private static instance: BalanceService;

  private constructor() {}

  static getInstance(): BalanceService {
    if (!BalanceService.instance) {
      BalanceService.instance = new BalanceService();
    }
    return BalanceService.instance;
  }

  /**
   * Fetch balance for a single address on a single chain with RPC failover
   */
  async fetchBalance(address: string, chainId: number): Promise<BalanceEntry> {
    const chainKey = `eip155:${chainId}`;
    const chainInfo = EIP155_CHAINS[chainKey];
    const chainName = chainInfo?.name || `Chain ${chainId}`;
    const symbol = chainInfo?.symbol || '';
    const rpcUrls = EIP155_RPCS_BY_CHAINS[chainId];

    if (!rpcUrls || rpcUrls.length === 0) {
      return {
        balance: '0',
        decimals: 18,
        timestamp: Date.now(),
        chainId,
        chainName,
        symbol,
        error: `No RPC URLs configured for chain ${chainId}`,
      };
    }

    // Try each RPC URL until one succeeds
    for (let i = 0; i < rpcUrls.length; i++) {
      const rpcUrl = rpcUrls[i];
      try {
        // console.log(`[BalanceService] Fetching balance for ${address} on chain ${chainId} via ${rpcUrl}`);

        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Set a timeout for the request (10 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('RPC request timeout')), 10000);
        });

        const balancePromise = provider.getBalance(address);
        const balance = await Promise.race([balancePromise, timeoutPromise]);

        // console.log(`[BalanceService] Successfully fetched balance: ${balance.toString()} Wei`);

        return {
          balance: balance.toString(),
          decimals: 18, // All major EVM chains use 18 decimals
          timestamp: Date.now(),
          chainId,
          chainName,
          symbol,
        };
      } catch (error) {
        console.warn(`[BalanceService] RPC ${rpcUrl} failed:`, error);

        // If this was the last RPC URL, return error
        if (i === rpcUrls.length - 1) {
          return {
            balance: '0',
            decimals: 18,
            timestamp: Date.now(),
            chainId,
            chainName,
            symbol,
            error: `All RPC endpoints failed for chain ${chainId}`,
          };
        }

        // Otherwise, continue to next RPC URL
        console.log(`[BalanceService] Trying next RPC URL...`);
      }
    }

    // Fallback (should never reach here)
    return {
      balance: '0',
      decimals: 18,
      timestamp: Date.now(),
      chainId,
      chainName,
      symbol,
      error: 'Unexpected error fetching balance',
    };
  }

  /**
   * Fetch balances for a single address across multiple chains concurrently
   */
  async fetchBalancesForAddress(
    address: string,
    chainIds: number[]
  ): Promise<Record<string, BalanceEntry>> {
    console.log(`[BalanceService] Fetching balances for ${address} across ${chainIds.length} chains`);

    const balancePromises = chainIds.map(chainId =>
      this.fetchBalance(address, chainId).then(entry => ({
        key: `${address}:${chainId}`,
        entry,
      }))
    );

    const results = await Promise.all(balancePromises);

    const balances: Record<string, BalanceEntry> = {};
    for (const { key, entry } of results) {
      balances[key] = entry;
    }

    return balances;
  }

  /**
   * Fetch balances for multiple addresses across multiple chains concurrently
   */
  async fetchBalancesForAddresses(
    addresses: string[],
    chainIds: number[]
  ): Promise<Record<string, BalanceEntry>> {
    console.log(
      `[BalanceService] Fetching balances for ${addresses.length} addresses across ${chainIds.length} chains`
    );

    const allPromises: Promise<{ key: string; entry: BalanceEntry }>[] = [];

    for (const address of addresses) {
      for (const chainId of chainIds) {
        allPromises.push(
          this.fetchBalance(address, chainId).then(entry => ({
            key: `${address}:${chainId}`,
            entry,
          }))
        );
      }
    }

    const results = await Promise.all(allPromises);

    const balances: Record<string, BalanceEntry> = {};
    for (const { key, entry } of results) {
      balances[key] = entry;
    }

    return balances;
  }

  /**
   * Get all supported chain IDs from EIP155_RPCS_BY_CHAINS
   */
  getSupportedChainIds(): number[] {
    return Object.keys(EIP155_RPCS_BY_CHAINS).map(Number);
  }
}

export default BalanceService.getInstance();
