import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SatodimeCard } from 'satochip-react-native';

import { useTheme } from '@/hooks/useTheme';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import NfcPrompt from '@/components/NfcPromptAndroid';
import useSatochipModal from '@/hooks/useSatochipModal';
import { ScannedSatodime, scanSatodime } from '@/wallets/satodime/SatodimeClient';
import SettingsStore from '@/store/SettingsStore';
import { SatodimeVaultState } from '@/types/WalletTypes';
import { handleSatodimeError } from '@/wallets/satodime/satodimeNfc';
import addAccountStyles from './addAccountStyles';

type Props = AccountsStackScreenProps<'AddSatodimeAccount'>;

/** Opportunistic update of accounts already added from this card. */
function updateKnownAccounts(scan: ScannedSatodime): void {
  const vaultStates: Partial<Record<number, SatodimeVaultState>> = {};
  for (const account of SettingsStore.getSatodimeWallets()) {
    const info = account.satodimeInfo;
    if (info.authentikey.toLowerCase() !== scan.authentikey.toLowerCase()) {
      continue;
    }
    const vault = scan.vaults.find(v => v.index === info.vaultIndex);
    // only if the vault still holds the account key (not reset and sealed again)
    if (vault?.pubkey && vault.pubkey.toLowerCase() === info.pubkey.toLowerCase()) {
      vaultStates[info.vaultIndex] = vault.state;
    }
  }
  SettingsStore.updateSatodimeCardState(scan.authentikey, {
    fixedUnlockSecret: scan.fixedUnlockSecret,
    cardHasOwner: scan.setupDone,
    vaultStates,
  });
}

export default function AddSatodimeAccountScreen({ navigation }: Props) {
  const Theme = useTheme();
  const card = useRef(new SatodimeCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  const [busy, setBusy] = useState(false);

  /** Run an NFC operation with the Android prompt, error toast and session cleanup. */
  const runWithCard = useCallback(
    async <T,>(operation: () => Promise<T>, errorTitle: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const run = withModal(operation);
        if (!run) {
          throw new Error('NFC is not supported on this platform');
        }
        return (await run()) as T;
      } catch (error) {
        console.warn(`[Satodime] ${errorTitle}: ${(error as Error)?.message}`);
        Toast.show({ type: 'error', text1: errorTitle, text2: handleSatodimeError(error) });
        return undefined;
      } finally {
        closeNfc();
        await card.endNfcSession().catch(() => undefined);
        setBusy(false);
      }
    },
    [card, closeNfc, withModal],
  );

  /**
   * Scan, then go to the vault list. Ownership is not needed to add a vault
   * (v0.2 cards disclose vault public data to anyone): the unlock code is
   * obtained when signing (CVC prompt, or claim of an ownerless card).
   */
  const handleScanCard = useCallback(async () => {
    const scan = await runWithCard(() => scanSatodime(card), 'Failed to read the card');
    if (!scan) {
      return;
    }
    console.info(
      `[Satodime] card scanned: ${scan.versionLabel}, ${scan.vaults.length} vault(s), cvc=${scan.fixedUnlockSecret}, owner=${scan.setupDone}, ownership=${scan.ownership}`,
    );
    updateKnownAccounts(scan);
    navigation.navigate('SatodimeVaultSelect', { scan });
  }, [card, navigation, runWithCard]);

  const scanDisabled = busy;

  return (
    <ScrollView
      style={[addAccountStyles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={addAccountStyles.content}
      contentInsetAdjustmentBehavior="automatic">
      <NfcPrompt visible={nfcVisible} close={closeNfc} />

      <View style={addAccountStyles.header}>
        <Text style={[addAccountStyles.title, { color: Theme['fg-100'] }]}>Add Satodime Account</Text>
        <Text style={[addAccountStyles.subtitle, { color: Theme['fg-150'] }]}>
          Use a vault of your Satodime card as an Ethereum or Polygon account
        </Text>
      </View>

      <View style={[addAccountStyles.instructionCard, { backgroundColor: Theme['bg-175'] }]}>
        <Text style={[addAccountStyles.instructionTitle, { color: Theme['fg-100'] }]}>Before you start:</Text>
        <View style={addAccountStyles.instructionList}>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • Make sure NFC is enabled on your device
          </Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • Satodime v0.2-0.1 or later is required to sign
          </Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • Sealed vaults are unsealed (with your permission) when you first sign
          </Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • No PIN: the card unlock code (or the code engraved on the card) is asked when signing
          </Text>
        </View>
      </View>

      <View style={addAccountStyles.scanSection}>
        <TouchableOpacity
          style={[addAccountStyles.scanButton, { backgroundColor: scanDisabled ? Theme['bg-250'] : Theme['accent-100'] }]}
          onPress={handleScanCard}
          disabled={scanDisabled}>
          <Text style={[addAccountStyles.scanButtonText, { color: scanDisabled ? Theme['fg-300'] : Theme['inverse-100'] }]}>
            {busy ? 'Scanning...' : 'Scan Satodime Card'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[addAccountStyles.helpCard, { backgroundColor: Theme['bg-175'] }]}>
        <Text style={[addAccountStyles.helpTitle, { color: Theme['fg-100'] }]}>Need help?</Text>
        <Text style={[addAccountStyles.helpDescription, { color: Theme['fg-150'] }]}>
          Hold the card close to the NFC antenna, usually on the back of your phone, until the scan completes.
          Bitcoin vaults (BTC, LTC, BCH, XCP) are shown but cannot be used in this app.
        </Text>
      </View>
    </ScrollView>
  );
}

