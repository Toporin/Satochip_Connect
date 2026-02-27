import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import SettingsStore from '@/store/SettingsStore';
import TokenService from '@/services/TokenService';
import { EIP155_TOKEN_SUPPORTED_CHAIN_IDS } from '@/constants/Eip155';

/**
 * Fetch token balances for all wallets in the store
 * This function can be called from anywhere to trigger a token balance fetch
 */
export async function fetchTokenBalancesForAllWallets(): Promise<void> {
  // Check if token balances were fetched recently (deduplication)
  if (SettingsStore.wereTokenBalancesFetchedRecently()) {
    console.log('[fetchTokenBalancesForAllWallets] Token balances were fetched recently, skipping...');
    return;
  }

  try {
    SettingsStore.setTokenBalancesLoading(true);
    SettingsStore.setTokenBalancesError(null);

    const allWallets = SettingsStore.getAllWallets();
    if (allWallets.length === 0) {
      console.log('[fetchTokenBalancesForAllWallets] No wallets to fetch token balances for');
      SettingsStore.setTokenBalancesLoading(false);
      return;
    }

    const addresses = allWallets.map(wallet => wallet.address);
    console.log(`[fetchTokenBalancesForAllWallets] Fetching token balances for ${addresses.length} wallets`);

    const balances = await TokenService.fetchTokenBalancesForAddresses(
      addresses,
      EIP155_TOKEN_SUPPORTED_CHAIN_IDS
    );

    SettingsStore.updateTokenBalances(balances);
    SettingsStore.setLastTokenBalanceFetch(Date.now());

    console.log(`[fetchTokenBalancesForAllWallets] Fetched ${Object.keys(balances).length} token balance entries`);
  } catch (error) {
    console.error('[fetchTokenBalancesForAllWallets] Error fetching token balances:', error);
    SettingsStore.setTokenBalancesError(
      error instanceof Error ? error.message : 'Failed to fetch token balances'
    );
  } finally {
    SettingsStore.setTokenBalancesLoading(false);
  }
}

/**
 * Hook that automatically fetches token balances when app comes to foreground
 *
 * Usage: Call this hook once in App.tsx
 */
export function useTokenBalanceFetching(): void {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[useTokenBalanceFetching] App has come to foreground, fetching token balances...');
      await fetchTokenBalancesForAllWallets();
    }

    appState.current = nextAppState;
  };
}
