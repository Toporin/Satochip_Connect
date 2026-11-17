/**
 * Build the ERC-4527 routing table from the wallets in SettingsStore.
 *
 * Account ids are the store keys (wallet.id), so the review screen can find
 * the signing wallet.
 */
import SettingsStore from '@/store/SettingsStore';
import type { AirgapAccount } from './signRequest';
import { singleKeyAirgapAccount } from './accounts';

export function getAirgapAccounts(): AirgapAccount[] {
  const accounts: AirgapAccount[] = [];

  // Satochip: crypto-hdkey (xpub at m/44'/60'/0'), matched by xfp + full path
  for (const wallet of SettingsStore.getSatochipWallets()) {
    accounts.push({ ...wallet.getWalletInfo(), id: wallet.id, kind: 'hd' });
  }

  // Satodime vaults: single key, crypto-account
  for (const wallet of SettingsStore.getSatodimeWallets()) {
    const info = wallet.getWalletInfo();
    try {
      accounts.push(singleKeyAirgapAccount(wallet.id, info.name, info.address, info.pubkey));
    } catch (error) {
      console.warn(`[Airgap] skipping Satodime account ${wallet.id}: ${(error as Error).message}`);
    }
  }

  // Software: mnemonic accounts like Satochip (crypto-hdkey); private-key
  // accounts as single keys (crypto-account). Pairing data is recorded on the
  // first unlock, so accounts never unlocked since are not routable yet.
  for (const wallet of SettingsStore.getSoftwareWallets()) {
    const info = wallet.getWalletInfo();
    if (info.xpub && info.masterXfp && info.derivationPath) {
      accounts.push({
        id: wallet.id,
        name: info.name,
        address: info.address,
        masterXfp: info.masterXfp,
        derivationPath: info.derivationPath,
        kind: 'hd',
      });
    } else if (info.keyType === 'privateKey' && info.publicKey) {
      try {
        accounts.push(singleKeyAirgapAccount(wallet.id, info.name, info.address, info.publicKey));
      } catch (error) {
        console.warn(`[Airgap] skipping software account ${wallet.id}: ${(error as Error).message}`);
      }
    }
  }

  return accounts;
}
