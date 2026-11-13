/**
 * Build the ERC-4527 routing table from the wallets in SettingsStore.
 */
import SettingsStore from '@/store/SettingsStore';
import { WalletType } from '@/types/WalletTypes';
import type { AirgapAccount } from './signRequest';
import { singleKeyAirgapAccount } from './accounts';

export function getAirgapAccounts(): AirgapAccount[] {
  const accounts: AirgapAccount[] = [];

  for (const wallet of SettingsStore.getSatochipWallets()) {
    accounts.push({ ...wallet.getWalletInfo(), kind: 'hd' });
  }

  for (const wallet of SettingsStore.getSatodimeWallets()) {
    const info = wallet.getWalletInfo();
    try {
      accounts.push(singleKeyAirgapAccount(info.id, info.name, info.address, info.pubkey));
    } catch (error) {
      console.warn(`[Airgap] skipping Satodime account ${info.id}: ${(error as Error).message}`);
    }
  }

  for (const wallet of SettingsStore.getSoftwareWallets()) {
    const info = wallet.getWalletInfo();
    if (wallet.type !== WalletType.SOFTWARE || !info.publicKey) {
      continue; // not paired yet: the public key is recorded on first unlock
    }
    try {
      accounts.push(singleKeyAirgapAccount(info.id, info.name, info.address, info.publicKey));
    } catch (error) {
      console.warn(`[Airgap] skipping software account ${info.id}: ${(error as Error).message}`);
    }
  }

  return accounts;
}
