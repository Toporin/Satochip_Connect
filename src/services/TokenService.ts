import Config from 'react-native-config';
import tokenList from '@uniswap/default-token-list';

import type { BalanceEntry } from '@/services/BalanceService';
import { ALCHEMY_NETWORK_SLUGS, EIP155_CHAINS } from '@/constants/Eip155';

export interface TokenBalanceEntry extends BalanceEntry {
  contract: string;   // ERC20 contract address (lowercase)
  name: string;       // token name (e.g., "USD Coin")
  logoURI?: string;   // optional token logo URL
}

interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

// Build lookup map from Uniswap default token list on module load (synchronous, one-time cost)
// Key: "chainId:contractAddress(lowercase)"
const UNISWAP_TOKEN_MAP = new Map<string, TokenMetadata>();
for (const t of tokenList.tokens) {
  UNISWAP_TOKEN_MAP.set(`${t.chainId}:${t.address.toLowerCase()}`, {
    name: t.name,
    symbol: t.symbol,
    decimals: t.decimals,
    logoURI: t.logoURI,
  });
}

// Reverse map: Alchemy network slug → chainId
const ALCHEMY_SLUG_TO_CHAIN_ID: Record<string, number> = Object.fromEntries(
  Object.entries(ALCHEMY_NETWORK_SLUGS).map(([chainId, slug]) => [slug, Number(chainId)])
);

class TokenService {
  private static instance: TokenService;

  // Permanent metadata cache (no TTL) — key: "chainId:contract"
  private metadataCache = new Map<string, TokenMetadata>();

  // 5-minute price cache — key: "chainId:contract"
  private priceCache = new Map<string, { usd: number; timestamp: number }>();
  private readonly PRICE_CACHE_TTL = 5 * 60 * 1000;

  private constructor() {}

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
   * Get token metadata, checking cache then Uniswap list then Alchemy API
   */
  private async getTokenMetadata(contract: string, chainId: number): Promise<TokenMetadata> {
    const key = `${chainId}:${contract.toLowerCase()}`;

    // 1. Check in-memory metadata cache
    const cached = this.metadataCache.get(key);
    if (cached) return cached;

    // 2. Check Uniswap token map (synchronous)
    const uniswap = UNISWAP_TOKEN_MAP.get(key);
    if (uniswap) {
      this.metadataCache.set(key, uniswap);
      return uniswap;
    }

    // 3. Fallback: call alchemy_getTokenMetadata
    const networkSlug = ALCHEMY_NETWORK_SLUGS[chainId];
    if (networkSlug) {
      try {
        const apiKey = Config.ENV_ALCHEMY_API_KEY;
        const response = await fetch(
          `https://${networkSlug}.g.alchemy.com/v2/${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'alchemy_getTokenMetadata',
              params: [contract],
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const result = data.result;
          if (result) {
            const metadata: TokenMetadata = {
              name: result.name || contract,
              symbol: result.symbol || '',
              decimals: result.decimals ?? 18,
              logoURI: result.logo || undefined,
            };
            this.metadataCache.set(key, metadata);
            return metadata;
          }
        }
      } catch (error) {
        console.warn(`[TokenService] Failed to fetch metadata for ${contract} on chain ${chainId}:`, error);
      }
    }

    // 4. Return defaults on failure
    const defaults: TokenMetadata = { name: contract, symbol: '', decimals: 18 };
    this.metadataCache.set(key, defaults);
    return defaults;
  }

  /**
   * Fetch ERC20 token balances for a single address on a single chain
   */
  async fetchTokenBalancesForAddress(
    address: string,
    chainId: number
  ): Promise<TokenBalanceEntry[]> {
    const networkSlug = ALCHEMY_NETWORK_SLUGS[chainId];
    if (!networkSlug) return [];

    const apiKey = Config.ENV_ALCHEMY_API_KEY;
    const url = `https://${networkSlug}.g.alchemy.com/v2/${apiKey}`;
    const chainKey = `eip155:${chainId}`;
    const chainInfo = EIP155_CHAINS[chainKey];
    const chainName = chainInfo?.name || `Chain ${chainId}`;

    const rawBalances: Array<{ contractAddress: string; tokenBalance: string }> = [];
    let pageKey: string | undefined;

    // Paginate through all results
    do {
      try {
        const params: [string, string, object] = [
          address,
          'erc20',
          pageKey ? { maxCount: 100, pageKey } : { maxCount: 100 },
        ];
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenBalances',
            params,
          }),
        });

        if (!response.ok) {
          console.warn(`[TokenService] getTokenBalances failed for chain ${chainId}: ${response.status}`);
          break;
        }

        const data = await response.json();
        const result = data.result;
        if (!result) break;

        rawBalances.push(...(result.tokenBalances || []));
        pageKey = result.pageKey;
      } catch (error) {
        console.warn(`[TokenService] Error fetching token balances for ${address} on chain ${chainId}:`, error);
        break;
      }
    } while (pageKey);

    // Filter out zero balances and resolve metadata
    const entries: TokenBalanceEntry[] = [];
    for (const { contractAddress, tokenBalance } of rawBalances) {
      // Skip zero balances (hex all-zeros)
      if (!tokenBalance || tokenBalance === '0x' || /^0x0+$/.test(tokenBalance)) continue;
      try {
        const balanceBigInt = BigInt(tokenBalance);
        if (balanceBigInt === 0n) continue;

        const contract = contractAddress.toLowerCase();
        const metadata = await this.getTokenMetadata(contract, chainId);

        entries.push({
          balance: balanceBigInt.toString(10),
          decimals: metadata.decimals,
          timestamp: Date.now(),
          chainId,
          chainName,
          symbol: metadata.symbol,
          name: metadata.name,
          contract,
          logoURI: metadata.logoURI,
        });
      } catch (error) {
        console.warn(`[TokenService] Error processing token ${contractAddress}:`, error);
      }
    }

    return entries;
  }

  /**
   * Batch-fetch token prices from Alchemy Prices API
   * Respects limits: ≤25 addresses, ≤3 networks per request
   */
  async fetchTokenPrices(
    tokens: Array<{ contract: string; chainId: number }>
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const now = Date.now();

    // Separate cached and uncached tokens
    const uncached: Array<{ contract: string; chainId: number }> = [];
    for (const token of tokens) {
      const cacheKey = `${token.chainId}:${token.contract}`;
      const cached = this.priceCache.get(cacheKey);
      if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
        result.set(cacheKey, cached.usd);
      } else {
        uncached.push(token);
      }
    }

    if (uncached.length === 0) return result;

    // Group uncached tokens by Alchemy network slug
    const byNetwork = new Map<string, string[]>();
    for (const token of uncached) {
      const slug = ALCHEMY_NETWORK_SLUGS[token.chainId];
      if (!slug) continue;
      const arr = byNetwork.get(slug) || [];
      arr.push(token.contract);
      byNetwork.set(slug, arr);
    }

    // Batch into groups of ≤3 networks
    const networkEntries = Array.from(byNetwork.entries());
    for (let i = 0; i < networkEntries.length; i += 3) {
      const networkBatch = networkEntries.slice(i, i + 3);

      // Build flat address list for this batch
      const allAddresses: Array<{ network: string; address: string }> = [];
      for (const [network, addresses] of networkBatch) {
        for (const address of addresses) {
          allAddresses.push({ network, address });
        }
      }

      // Split into chunks of ≤25 addresses
      for (let j = 0; j < allAddresses.length; j += 25) {
        const chunk = allAddresses.slice(j, j + 25);
        try {
          const apiKey = Config.ENV_ALCHEMY_API_KEY;
          const response = await fetch(
            `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ addresses: chunk }),
            }
          );

          if (!response.ok) {
            console.warn(`[TokenService] Price fetch failed: ${response.status}`);
            continue;
          }

          const data = await response.json();
          const fetchedAt = Date.now();

          for (const item of data.data || []) {
            if (item.error || !item.prices?.length) continue;
            const address = item.address?.toLowerCase();
            const networkSlug = item.network;
            const chainId = ALCHEMY_SLUG_TO_CHAIN_ID[networkSlug];
            if (!chainId || !address) continue;

            const usdEntry = item.prices.find((p: { currency: string; value: string }) => p.currency === 'usd');
            if (!usdEntry) continue;

            const price = parseFloat(usdEntry.value);
            if (isNaN(price)) continue;

            const cacheKey = `${chainId}:${address}`;
            this.priceCache.set(cacheKey, { usd: price, timestamp: fetchedAt });
            result.set(cacheKey, price);
          }
        } catch (error) {
          console.error('[TokenService] Error fetching prices batch:', error);
        }
      }
    }

    return result;
  }

  /**
   * Fetch token balances for multiple addresses across multiple chains,
   * then attach USD prices. Returns flat record keyed by "address:chainId:contract"
   */
  async fetchTokenBalancesForAddresses(
    addresses: string[],
    chainIds: number[]
  ): Promise<Record<string, TokenBalanceEntry>> {
    console.log(
      `[TokenService] Fetching token balances for ${addresses.length} addresses across ${chainIds.length} chains`
    );

    // Concurrently fetch balances for all address×chainId pairs
    const fetchPromises: Promise<{ key: string; entry: TokenBalanceEntry }[]>[] = [];

    for (const address of addresses) {
      for (const chainId of chainIds) {
        fetchPromises.push(
          this.fetchTokenBalancesForAddress(address, chainId)
            .then(entries =>
              entries.map(entry => ({
                key: `${address}:${chainId}:${entry.contract}`,
                entry,
              }))
            )
            .catch(error => {
              console.warn(`[TokenService] Failed for ${address} on chain ${chainId}:`, error);
              return [];
            })
        );
      }
    }

    const allResults = await Promise.all(fetchPromises);
    const flat = allResults.flat();

    const result: Record<string, TokenBalanceEntry> = {};
    for (const { key, entry } of flat) {
      result[key] = entry;
    }

    // Batch-fetch prices for all unique tokens
    const uniqueTokens = flat.map(({ entry }) => ({
      contract: entry.contract,
      chainId: entry.chainId,
    }));

    if (uniqueTokens.length > 0) {
      const prices = await this.fetchTokenPrices(uniqueTokens);

      for (const [_key, entry] of Object.entries(result)) {
        const priceKey = `${entry.chainId}:${entry.contract}`;
        const price = prices.get(priceKey);
        if (price !== undefined) {
          entry.usdPrice = price;
          const balanceNum = parseFloat(entry.balance);
          if (!isNaN(balanceNum) && balanceNum > 0) {
            const tokenAmount = balanceNum / Math.pow(10, entry.decimals);
            entry.usdValue = tokenAmount * price;
          }
        }
      }
    }

    return result;
  }
}

export default TokenService.getInstance();
