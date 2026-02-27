import {useCallback, useEffect, useRef, useState} from 'react';
import {useSnapshot} from 'valtio';

import SettingsStore from '@/store/SettingsStore';
import {createWalletKit, walletKit} from '@/utils/WalletKitUtil';
import { NFCManager } from '@/wallets/nfc/NFCManager';
import { fetchBalancesForAllWallets } from '@/hooks/useBalanceFetching';
import { fetchTokenBalancesForAllWallets } from '@/hooks/useTokenBalanceFetching';
import { fetchNftBalancesForAllWallets } from '@/hooks/useNftFetching';

export default function useInitializeWalletKit() {
  const [initialized, setInitialized] = useState(false);
  const prevRelayerURLValue = useRef<string>('');

  const {relayerRegionURL} = useSnapshot(SettingsStore.state);

  const onInitialize = useCallback(async () => {
    try {
      console.log('Initializing WalletKit with hardware wallet support...');
      
      // Initialize NFC Manager and check capabilities
      const nfcManager = NFCManager.getInstance();
      const nfcCapabilities = await nfcManager.checkNFCAvailability();
      console.log('NFC Capabilities:', nfcCapabilities);
      // todo: check NFC availability

      // load SoftwareWallets from persistent memory
      await SettingsStore.loadSoftwareWallets();

      // Load Satochip wallets from persistent memory
      await SettingsStore.loadSatochipWallets();

      // Initialize WalletConnect
      await createWalletKit(relayerRegionURL);

      setInitialized(true);
      SettingsStore.state.initPromiseResolver?.resolve(undefined);

      console.log('WalletKit initialization completed successfully');
      console.log(`Total wallets initialized: ${SettingsStore.getAllWallets().length}`);

      // Fetch balances and token balances after initialization
      console.log('Fetching balances after initialization...');
      const balancePromise = fetchBalancesForAllWallets().catch(err => {
        console.error('Error fetching balances after initialization:', err);
      });
      const tokenPromise = fetchTokenBalancesForAllWallets().catch(err => {
        console.error('Error fetching token balances after initialization:', err);
      });
      // NFTs have lower priority — start after balances and tokens resolve
      Promise.allSettled([balancePromise, tokenPromise]).then(() => {
        fetchNftBalancesForAllWallets().catch(err => {
          console.error('Error fetching NFTs after initialization:', err);
        });
      });
    } catch (err: unknown) {
      console.error('WalletKit initialization failed:', err);
      SettingsStore.state.initPromiseResolver?.reject(err);
    }
  }, [relayerRegionURL]);

  // restart transport if relayer region changes
  const onRelayerRegionChange = useCallback(() => {
    try {
      walletKit.core.relayer.restartTransport(relayerRegionURL);
      prevRelayerURLValue.current = relayerRegionURL;
    } catch (err: unknown) {
      console.error(err);
    }
  }, [relayerRegionURL]);

  useEffect(() => {
    if (!initialized) {
      onInitialize();
    }
    if (prevRelayerURLValue.current !== relayerRegionURL) {
      onRelayerRegionChange();
    }
  }, [initialized, onInitialize, relayerRegionURL, onRelayerRegionChange]);

  return initialized;
}
