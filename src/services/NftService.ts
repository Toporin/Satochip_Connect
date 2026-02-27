import Config from 'react-native-config';

import type { BalanceEntry } from '@/services/BalanceService';
import { ALCHEMY_NETWORK_SLUGS, EIP155_CHAINS } from '@/constants/Eip155';

export interface NftEntry extends BalanceEntry {
  contract: string;         // NFT contract address (lowercase)
  contractName?: string;    // NFT contract name
  contractSymbol?: string;  // NFT contract symbol
  tokenId: string;          // NFT token ID
  tokenType: 'ERC721' | 'ERC1155';
  name?: string;            // NFT item name
  description?: string;     // NFT description
  thumbnailUrl?: string;    // Thumbnail image URL
  imageUrl?: string;        // Original/cached image URL
}

class NftService {
  private static instance: NftService;

  private constructor() {}

  static getInstance(): NftService {
    if (!NftService.instance) {
      NftService.instance = new NftService();
    }
    return NftService.instance;
  }

  /**
   * Fetch NFTs owned by an address on a single chain.
   * Uses Alchemy getNFTsForOwner v3 with pagination.
   */
  async fetchNftsForAddress(address: string, chainId: number): Promise<NftEntry[]> {
    const networkSlug = ALCHEMY_NETWORK_SLUGS[chainId];
    if (!networkSlug) return [];

    const apiKey = Config.ENV_ALCHEMY_API_KEY;
    const chainKey = `eip155:${chainId}`;
    const chainInfo = EIP155_CHAINS[chainKey];
    const chainName = chainInfo?.name || `Chain ${chainId}`;

    const entries: NftEntry[] = [];
    let pageKey: string | undefined;

    do {
      try {
        let url =
          `https://${networkSlug}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner` +
          `?owner=${encodeURIComponent(address)}` +
          `&withMetadata=true` +
          `&pageSize=100`;
        if (pageKey) {
          url += `&pageKey=${encodeURIComponent(pageKey)}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: { accept: 'application/json' },
        });
        console.warn(JSON.stringify(response, null, 2));

        if (!response.ok) {
          console.warn(
            `[NftService] getNFTsForOwner failed for chain ${chainId}: ${response.status}`
          );
          break;
        }

        const data = await response.json();

        for (const nft of data.ownedNfts || []) {
          try {
            const contract = (nft.contract?.address || '').toLowerCase();
            if (!contract) continue;

            const tokenId: string = String(nft.tokenId || '');
            const tokenType: 'ERC721' | 'ERC1155' =
              nft.tokenType === 'ERC1155' ? 'ERC1155' : 'ERC721';
            const balance = tokenType === 'ERC1155' ? String(nft.balance || '1') : '1';

            entries.push({
              balance,
              decimals: 0,
              timestamp: Date.now(),
              chainId,
              chainName,
              symbol: nft.contract?.symbol || '',
              contract,
              contractName: nft.contract?.name || undefined,
              contractSymbol: nft.contract?.symbol || undefined,
              tokenId,
              tokenType,
              name: nft.name || undefined,
              description: nft.description || undefined,
              thumbnailUrl: nft.image?.thumbnailUrl || undefined,
              imageUrl:
                nft.image?.cachedUrl || nft.image?.originalUrl || undefined,
            });
          } catch (err) {
            console.warn('[NftService] Error processing NFT item:', err);
          }
        }

        pageKey = data.pageKey;
      } catch (error) {
        console.warn(
          `[NftService] Error fetching NFTs for ${address} on chain ${chainId}:`,
          error
        );
        break;
      }
    } while (pageKey);

    return entries;
  }

  /**
   * Fetch NFTs for multiple addresses across multiple chains concurrently.
   * Returns a flat record keyed by "address:chainId:contract:tokenId".
   */
  async fetchNftsForAddresses(
    addresses: string[],
    chainIds: number[]
  ): Promise<Record<string, NftEntry>> {
    console.log(
      `[NftService] Fetching NFTs for ${addresses.length} addresses across ${chainIds.length} chains`
    );

    const fetchPromises: Promise<{ key: string; entry: NftEntry }[]>[] = [];

    for (const address of addresses) {
      for (const chainId of chainIds) {
        fetchPromises.push(
          this.fetchNftsForAddress(address, chainId)
            .then(nfts =>
              nfts.map(entry => ({
                key: `${address}:${chainId}:${entry.contract}:${entry.tokenId}`,
                entry,
              }))
            )
            .catch(error => {
              console.warn(
                `[NftService] Failed for ${address} on chain ${chainId}:`,
                error
              );
              return [];
            })
        );
      }
    }

    const allResults = await Promise.all(fetchPromises);
    const flat = allResults.flat();

    const result: Record<string, NftEntry> = {};
    for (const { key, entry } of flat) {
      result[key] = entry;
    }

    console.log(`[NftService] Fetched ${flat.length} NFTs total`);
    return result;
  }
}

export default NftService.getInstance();
