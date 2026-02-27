import SettingsStore from '@/store/SettingsStore';
import NftService from '@/services/NftService';
import { EIP155_NFT_SUPPORTED_CHAIN_IDS } from '@/constants/Eip155';

/**
 * Fetch NFT balances for all wallets in the store.
 * This function can be called from anywhere to trigger an NFT fetch.
 *
 * NFTs do NOT auto-refresh when the app comes to foreground — they are fetched
 * once on initialization and on manual pull-to-refresh only.
 */
export async function fetchNftBalancesForAllWallets(): Promise<void> {
  if (SettingsStore.wereNftBalancesFetchedRecently()) {
    console.log('[fetchNftBalancesForAllWallets] NFT balances were fetched recently, skipping...');
    return;
  }

  try {
    SettingsStore.setNftBalancesLoading(true);
    SettingsStore.setNftBalancesError(null);

    const allWallets = SettingsStore.getAllWallets();
    if (allWallets.length === 0) {
      console.log('[fetchNftBalancesForAllWallets] No wallets to fetch NFTs for');
      SettingsStore.setNftBalancesLoading(false);
      return;
    }

    const addresses = allWallets.map(wallet => wallet.address);
    console.log(`[fetchNftBalancesForAllWallets] Fetching NFTs for ${addresses.length} wallets`);

    const nfts = await NftService.fetchNftsForAddresses(
      addresses,
      EIP155_NFT_SUPPORTED_CHAIN_IDS
    );

    SettingsStore.updateNftBalances(nfts);
    SettingsStore.setLastNftBalanceFetch(Date.now());

    console.log(`[fetchNftBalancesForAllWallets] Fetched ${Object.keys(nfts).length} NFT entries`);
  } catch (error) {
    console.error('[fetchNftBalancesForAllWallets] Error:', error);
    SettingsStore.setNftBalancesError(
      error instanceof Error ? error.message : 'Failed to fetch NFTs'
    );
  } finally {
    SettingsStore.setNftBalancesLoading(false);
  }
}

/**
 * Hook for NFT balance fetching.
 * Unlike balance/token fetching, NFTs do NOT auto-refresh when app comes to foreground.
 * NFTs are fetched once on initialization and on manual pull-to-refresh only.
 */
export function useNftFetching(): void {
  // No AppState listener — NFTs only refresh on init and manual pull-to-refresh
}
