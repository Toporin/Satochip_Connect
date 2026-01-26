import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import SettingsStore from '@/store/SettingsStore';
import BalanceService from '@/services/BalanceService';
import PriceService from '@/services/PriceService';

/**
 * Fetch balances for all wallets in the store
 * This function can be called from anywhere to trigger a balance fetch
 */
export async function fetchBalancesForAllWallets(): Promise<void> {
  // Check if balances were fetched recently (deduplication)
  if (SettingsStore.wereBalancesFetchedRecently()) {
    console.log('[fetchBalancesForAllWallets] Balances were fetched recently, skipping...');
    return;
  }

  try {
    SettingsStore.setBalancesLoading(true);
    SettingsStore.setBalancesError(null);

    // Get all wallet addresses
    const allWallets = SettingsStore.getAllWallets();
    if (allWallets.length === 0) {
      console.log('[fetchBalancesForAllWallets] No wallets to fetch balances for');
      SettingsStore.setBalancesLoading(false);
      return;
    }

    const addresses = allWallets.map(wallet => wallet.address);
    console.log(`[fetchBalancesForAllWallets] Fetching balances for ${addresses.length} wallets`);

    // Get supported chain IDs
    const chainIds = BalanceService.getSupportedChainIds();

    // Fetch balances for all addresses across all chains
    const balances = await BalanceService.fetchBalancesForAddresses(addresses, chainIds);

    // Fetch prices for all chains
    const prices = await PriceService.getPricesForChains(chainIds);

    // Calculate USD values
    for (const [_key, entry] of Object.entries(balances)) {
      const price = prices[entry.chainId];
      if (price !== undefined && !entry.error) {
        const balanceNum = parseFloat(entry.balance);
        if (!isNaN(balanceNum) && balanceNum > 0) {
          const decimals = entry.decimals || 18;
          const divisor = Math.pow(10, decimals);
          const tokenAmount = balanceNum / divisor;
          entry.usdPrice = price;
          entry.usdValue = tokenAmount * price;
        }
      }
    }

    // Update store
    SettingsStore.updateBalances(balances);
    SettingsStore.setLastBalanceFetch(Date.now());

    // console.log(`[fetchBalancesForAllWallets] Successfully fetched balances for ${Object.keys(balances).length} address-chain pairs`);
  } catch (error) {
    console.error('[fetchBalancesForAllWallets] Error fetching balances:', error);
    SettingsStore.setBalancesError(
      error instanceof Error ? error.message : 'Failed to fetch balances'
    );
  } finally {
    SettingsStore.setBalancesLoading(false);
  }
}

/**
 * Hook that automatically fetches balances when app comes to foreground
 *
 * Usage: Call this hook once in App.tsx
 */
export function useBalanceFetching() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    // If app is coming to foreground
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[useBalanceFetching] App has come to foreground, fetching balances...');
      await fetchBalancesForAllWallets();
    }

    appState.current = nextAppState;
  };
}
