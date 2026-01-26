/**
 * PriceService - Fetches cryptocurrency prices from CoinGecko API
 *
 * Features:
 * - Simple in-memory caching (session-based, no persistence)
 * - Batch price fetching for multiple chains
 * - Chain ID to CoinGecko coin ID mapping
 */

// Map chain IDs to CoinGecko coin IDs
const CHAIN_TO_COINGECKO_ID: Record<number, string> = {
  // Ethereum and its L2s use ETH
  1: 'ethereum',
  // 5: 'ethereum', // Goerli DEPRECATED
  // 11155111: 'ethereum', // Sepolia TESTNET
  10: 'ethereum', // Optimism
  // 420: 'ethereum', // Optimism Goerli DEPRECATED
  // 11155420: 'ethereum', // Optimism Sepolia TESTNET
  42161: 'ethereum', // Arbitrum
  // 421613: 'ethereum', // Arbitrum Goerli DEPRECATED
  8453: 'ethereum', // Base
  // 84531: 'ethereum', // Base Goerli DEPRECATED
  324: 'ethereum', // zkSync Era
  7777777: 'ethereum', // Zora
  1313161554: 'ethereum', // Aurora

  // Other chains
  137: 'matic-network', // Polygon
  // 80001: 'matic-network', // Polygon Mumbai TESTNET
  1101: 'matic-network', // Polygon zkEVM
  56: 'binancecoin', // BSC
  // 97: 'binancecoin', // BSC Testnet
  43114: 'avalanche-2', // Avalanche
  // 43113: 'avalanche-2', // Avalanche Fuji TESTNET
  250: 'fantom', // Fantom
  100: 'xdai', // Gnosis
  9001: 'evmos', // Evmos
  314: 'filecoin', // Filecoin
  4689: 'iotex', // IoTeX
  1088: 'metis-token', // Metis
  1284: 'moonbeam', // Moonbeam
  1285: 'moonriver', // Moonriver
  42220: 'celo', // Celo
  1666600000: 'harmony', // Harmony
};

interface PriceCache {
  [coinId: string]: {
    usd: number;
    timestamp: number;
  };
}

class PriceService {
  private static instance: PriceService;
  private cache: PriceCache = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  /**
   * Get CoinGecko coin ID for a chain ID
   */
  private getCoinIdForChain(chainId: number): string | null {
    return CHAIN_TO_COINGECKO_ID[chainId] || null;
  }

  /**
   * Fetch prices from CoinGecko API
   */
  private async fetchPricesFromAPI(coinIds: string[]): Promise<Record<string, number>> {
    const uniqueCoinIds = Array.from(new Set(coinIds));

    if (uniqueCoinIds.length === 0) {
      return {};
    }

    try {
      const idsParam = uniqueCoinIds.join(',');
      const url = `${this.COINGECKO_API_BASE}/simple/price?ids=${idsParam}&vs_currencies=usd`;

      console.log(`[PriceService] Fetching prices for: ${idsParam}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse response and update cache
      const prices: Record<string, number> = {};
      const now = Date.now();

      for (const coinId of uniqueCoinIds) {
        if (data[coinId]?.usd !== undefined) {
          const price = data[coinId].usd;
          prices[coinId] = price;

          // Update cache
          this.cache[coinId] = {
            usd: price,
            timestamp: now,
          };

          console.log(`[PriceService] ${coinId}: $${price}`);
        }
      }

      return prices;
    } catch (error) {
      console.error('[PriceService] Error fetching prices from CoinGecko:', error);
      return {};
    }
  }

  /**
   * Get price for a single chain (with caching)
   */
  async getPriceForChain(chainId: number): Promise<number | null> {
    const coinId = this.getCoinIdForChain(chainId);
    if (!coinId) {
      // console.warn(`[PriceService] No CoinGecko mapping for chain ${chainId}`);
      return null;
    }

    // Check cache
    const cached = this.cache[coinId];
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      // console.log(`[PriceService] Using cached price for ${coinId}: $${cached.usd}`);
      return cached.usd;
    }

    // Fetch from API
    const prices = await this.fetchPricesFromAPI([coinId]);
    return prices[coinId] ?? null;
  }

  /**
   * Get prices for multiple chains (batch fetch with caching)
   */
  async getPricesForChains(chainIds: number[]): Promise<Record<number, number>> {
    const coinIdsToFetch: string[] = [];
    const coinIdToChainIds: Record<string, number[]> = {};
    const now = Date.now();
    const result: Record<number, number> = {};

    // Separate cached and non-cached requests
    for (const chainId of chainIds) {
      const coinId = this.getCoinIdForChain(chainId);
      if (!coinId) {
        // console.warn(`[PriceService] No CoinGecko mapping for chain ${chainId}`);
        continue;
      }

      // Track which chain IDs map to this coin ID
      if (!coinIdToChainIds[coinId]) {
        coinIdToChainIds[coinId] = [];
      }
      coinIdToChainIds[coinId].push(chainId);

      // Check cache
      const cached = this.cache[coinId];
      if (cached && now - cached.timestamp < this.CACHE_DURATION) {
        // console.log(`[PriceService] Using cached price for ${coinId}: $${cached.usd}`);
        result[chainId] = cached.usd;
      } else if (!coinIdsToFetch.includes(coinId)) {
        coinIdsToFetch.push(coinId);
      }
    }

    // Fetch prices not in cache
    if (coinIdsToFetch.length > 0) {
      const prices = await this.fetchPricesFromAPI(coinIdsToFetch);

      // Map fetched prices to all relevant chain IDs
      for (const [coinId, price] of Object.entries(prices)) {
        const relatedChainIds = coinIdToChainIds[coinId] || [];
        for (const chainId of relatedChainIds) {
          result[chainId] = price;
        }
      }
    }

    return result;
  }

  /**
   * Clear the price cache
   */
  clearCache(): void {
    this.cache = {};
    console.log('[PriceService] Cache cleared');
  }
}

export default PriceService.getInstance();
