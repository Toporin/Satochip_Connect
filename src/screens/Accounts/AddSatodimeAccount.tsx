import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SatodimeCard } from 'satochip-react-native';

import { useTheme } from '@/hooks/useTheme';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import NfcPrompt from '@/components/NfcPromptAndroid';
import useSatochipModal from '@/hooks/useSatochipModal';
import {
  ScannedSatodime,
  claimSatodime,
  registerSatodimeCvc,
  scanSatodime,
} from '@/wallets/satodime/SatodimeClient';
import { handleSatodimeError } from '@/wallets/satodime/satodimeNfc';
import addAccountStyles from './addAccountStyles';
import setupStyles from './setupStyles';

type Props = AccountsStackScreenProps<'AddSatodimeAccount'>;

export default function AddSatodimeAccountScreen({ navigation }: Props) {
  const Theme = useTheme();
  const card = useRef(new SatodimeCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  const [busy, setBusy] = useState(false);
  // scan waiting for an ownership step (CVC entry or refusal message)
  const [pendingScan, setPendingScan] = useState<ScannedSatodime | null>(null);
  const [cvc, setCvc] = useState('');

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

  const goToVaults = useCallback(
    (scan: ScannedSatodime) => {
      setPendingScan(null);
      setCvc('');
      navigation.navigate('SatodimeVaultSelect', { scan });
    },
    [navigation],
  );

  const claimOwnership = useCallback(
    async (scan: ScannedSatodime) => {
      const done = await runWithCard(async () => {
        await claimSatodime(card, scan.authentikey);
        return true;
      }, 'Failed to claim the card');
      if (done) {
        Toast.show({ type: 'success', text1: 'You are now the owner of this Satodime' });
        goToVaults({ ...scan, ownership: 'owner', setupDone: true });
      }
    },
    [card, goToVaults, runWithCard],
  );

  const handleScanCard = useCallback(async () => {
    const scan = await runWithCard(() => scanSatodime(card), 'Failed to read the card');
    if (!scan) {
      return;
    }
    console.info(`[Satodime] card scanned: ${scan.versionLabel}, ${scan.vaults.length} vault(s), ownership=${scan.ownership}`);

    if (!scan.supportsHashSigning || scan.ownership === 'owner') {
      // unsupported versions are explained on the vault screen
      goToVaults(scan);
      return;
    }
    if (scan.ownership === 'unclaimed') {
      Alert.alert(
        'Claim this Satodime?',
        'This card has no owner. Claiming it makes this phone its owner: only this phone will be able to sign with its vaults. You will need to tap the card again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Claim', onPress: () => claimOwnership(scan) },
        ],
      );
      return;
    }
    // 'cvc-required' or 'owned-elsewhere': shown below
    setPendingScan(scan);
  }, [card, claimOwnership, goToVaults, runWithCard]);

  const handleSubmitCvc = useCallback(async () => {
    if (!pendingScan) {
      return;
    }
    const done = await runWithCard(async () => {
      await registerSatodimeCvc(card, pendingScan.authentikey, cvc);
      return true;
    }, 'Card code not accepted');
    if (done) {
      goToVaults({ ...pendingScan, ownership: 'owner' });
    }
  }, [card, cvc, goToVaults, pendingScan, runWithCard]);

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
            • Only unsealed vaults can sign; sealed vaults are added as watch-only
          </Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • No PIN is needed: whoever holds the card and its unlock code controls unsealed vaults
          </Text>
        </View>
      </View>

      {pendingScan?.ownership === 'cvc-required' && (
        <View style={[addAccountStyles.instructionCard, { backgroundColor: Theme['bg-175'] }]}>
          <Text style={[addAccountStyles.instructionTitle, { color: Theme['fg-100'] }]}>Card code required</Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            This card belongs to another device. Enter the code printed on the card to use it from this phone,
            then tap the card again.
          </Text>
          <TextInput
            style={[
              setupStyles.textInput,
              styles.spaced,
              { backgroundColor: Theme['bg-150'], color: Theme['fg-100'], borderColor: Theme['bg-250'] },
            ]}
            placeholder="Card code"
            placeholderTextColor={Theme['fg-300']}
            value={cvc}
            onChangeText={setCvc}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
          />
          <TouchableOpacity
            style={[
              addAccountStyles.scanButton,
              styles.spaced,
              { backgroundColor: busy || !cvc.trim() ? Theme['bg-250'] : Theme['accent-100'] },
            ]}
            onPress={handleSubmitCvc}
            disabled={busy || !cvc.trim()}>
            <Text style={[addAccountStyles.scanButtonText, { color: busy || !cvc.trim() ? Theme['fg-300'] : Theme['inverse-100'] }]}>
              Verify code
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {pendingScan?.ownership === 'owned-elsewhere' && (
        <View style={[addAccountStyles.instructionCard, { backgroundColor: Theme['bg-175'] }]}>
          <Text style={[addAccountStyles.instructionTitle, { color: Theme['error-100'] }]}>Card owned by another device</Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            This Satodime belongs to another device. Release its ownership from that device first (transfer ownership
            in the Satodime app), then scan it again here.
          </Text>
        </View>
      )}

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

const styles = StyleSheet.create({
  spaced: {
    marginTop: 12,
  },
});
