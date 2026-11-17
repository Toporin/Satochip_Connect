import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackScreenProps} from '@/utils/TypesUtil';
import SettingsStore from '@/store/SettingsStore';
import {SatodimeInfo, SatodimeVaultState, WalletType} from '@/types/WalletTypes';
import {useTheme} from '@/hooks/useTheme';
import {ActionButton} from '@/components/ActionButton';
import {PinModal} from '@/components/Modal/PinModal';
import {EIP155SoftwareWallet} from '@/wallets/EIP155SoftwareWallet';
import {
  SOFTWARE_DEVICE_NAME,
  buildSingleKeyPairing,
  satodimeDeviceName,
} from '@/airgap/singleKeyPayload';
import {AnimatedUrQR} from './AnimatedUrQR';

type Props = RootStackScreenProps<'AirgapSingleKeySync'>;

/** Full address with the first 6 and last 4 characters emphasized (as shortened by MetaMask). */
export function EmphasizedAddress({address, color, strongColor}: {address: string; color: string; strongColor: string}) {
  return (
    <Text style={[styles.mono, {color}]} selectable>
      <Text style={[styles.strong, {color: strongColor}]}>{address.slice(0, 6)}</Text>
      {address.slice(6, -4)}
      <Text style={[styles.strong, {color: strongColor}]}>{address.slice(-4)}</Text>
    </Text>
  );
}

export default function SingleKeySyncScreen({route, navigation}: Props) {
  const Theme = useTheme();
  const insets = useSafeAreaInsets();
  const {accountId} = route.params;
  const wallet = SettingsStore.getWallet(accountId);

  const [showHelpers, setShowHelpers] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  // bumped after a software unlock records the public key
  const [keyVersion, setKeyVersion] = useState(0);

  const source = useMemo((): {publicKey?: string; name: string; sealed: boolean; error?: string} => {
    if (wallet?.type === WalletType.SATODIME) {
      const info = wallet.getWalletInfo() as SatodimeInfo;
      return {
        publicKey: info.pubkey,
        name: satodimeDeviceName(info.vaultIndex),
        sealed: info.vaultState !== SatodimeVaultState.UNSEALED,
      };
    }
    if (wallet instanceof EIP155SoftwareWallet) {
      return {publicKey: wallet.getPublicKey(), name: SOFTWARE_DEVICE_NAME, sealed: false};
    }
    return {name: '', sealed: false, error: 'QR pairing with a single key is only available for Satodime and software accounts.'};
    // keyVersion: recompute once the software public key is recorded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, keyVersion]);

  const {pairing, error} = useMemo(() => {
    if (!source.publicKey) {
      return {pairing: undefined, error: source.error};
    }
    try {
      const p = buildSingleKeyPairing(source.publicKey, source.name);
      if (wallet && p.primaryAddress.toLowerCase() !== wallet.address.toLowerCase()) {
        return {pairing: undefined, error: 'The stored public key does not match this account address.'};
      }
      return {pairing: p, error: undefined};
    } catch (e) {
      console.warn('[Airgap] cannot build crypto-account QR:', (e as Error).message);
      return {pairing: undefined, error: (e as Error).message};
    }
  }, [source, wallet]);

  const unlockSoftware = useCallback(
    async (password: string) => {
      setShowPassword(false);
      if (!(wallet instanceof EIP155SoftwareWallet)) {
        return;
      }
      try {
        await wallet.unlockWallet(password);
        SettingsStore.rememberSoftwarePublicKeys();
        setUnlockError(null);
        setKeyVersion(v => v + 1);
      } catch {
        setUnlockError('Wrong password, or the account could not be unlocked.');
      }
    },
    [wallet],
  );

  // Mnemonic software accounts pair with crypto-hdkey (xpub), like Satochip
  const isMnemonicSoftware = wallet instanceof EIP155SoftwareWallet && wallet.getWalletInfo().keyType === 'mnemonic';
  useEffect(() => {
    if (isMnemonicSoftware) {
      navigation.replace('AirgapSync', {accountId});
    }
  }, [accountId, isMnemonicSoftware, navigation]);

  const needsSoftwareUnlock = wallet instanceof EIP155SoftwareWallet && !source.publicKey;

  return (
    <ScrollView
      style={{backgroundColor: Theme['bg-100']}}
      contentContainerStyle={[styles.content, {paddingBottom: 16 + insets.bottom}]}>
      {wallet && (
        <View style={styles.header}>
          <Text style={[styles.name, {color: Theme['fg-100']}]}>{wallet.getWalletInfo().name}</Text>
          {source.name ? (
            <Text style={[styles.small, {color: Theme['fg-175']}]}>Shown in the extension as “{source.name}”</Text>
          ) : null}
        </View>
      )}

      {needsSoftwareUnlock && (
        <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
          <Text style={[styles.text, {color: Theme['fg-150']}]}>
            To create the pairing QR code, this account's public key is needed once. Enter the account password: only
            the public key is saved.
          </Text>
          {unlockError && <Text style={[styles.text, {color: Theme['error-100']}]}>{unlockError}</Text>}
          <ActionButton style={styles.button} onPress={() => setShowPassword(true)}>
            Enter password
          </ActionButton>
        </View>
      )}

      {!needsSoftwareUnlock && error && (
        <Text style={[styles.text, styles.center, {color: Theme['error-100']}]}>{error}</Text>
      )}

      {pairing && (
        <>
          <View style={[styles.card, styles.important, {borderColor: Theme['accent-100']}]}>
            <Text style={[styles.text, {color: Theme['fg-100']}]}>
              Your browser wallet will show <Text style={styles.strong}>5 addresses</Text>. Select{' '}
              <Text style={styles.strong}>only the first one</Text>:
            </Text>
            <EmphasizedAddress address={pairing.primaryAddress} color={Theme['fg-150']} strongColor={Theme['accent-100']} />
            <Text style={[styles.text, {color: Theme['error-100']}]}>
              The other 4 are helper addresses required by MetaMask. Don't select them and never send funds to them.
            </Text>
          </View>

          {source.sealed && (
            <Text style={[styles.text, {color: Theme['fg-150']}]}>
              This vault is sealed: it will be unsealed, with your permission, at the first signature.
            </Text>
          )}

          <AnimatedUrQR ur={pairing.ur} />

          <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
            <Text style={[styles.cardTitle, {color: Theme['fg-100']}]}>How to connect</Text>
            <Text style={[styles.subTitle, {color: Theme['fg-100']}]}>MetaMask</Text>
            <Text style={[styles.text, {color: Theme['fg-150']}]}>
              Account menu → Add account or hardware wallet → Hardware wallet → QR-based → Continue. Show this QR code
              to your computer's camera, then tick only the first address ({pairing.primaryAddress.slice(0, 6)}…
              {pairing.primaryAddress.slice(-4)}) and unlock.
            </Text>
            <Text style={[styles.subTitle, {color: Theme['fg-100']}]}>Rabby</Text>
            <Text style={[styles.text, {color: Theme['fg-150']}]}>
              Add address → Connect hardware wallet → Keystone / QR-based wallet. Scan this QR code, then import only the
              first address.
            </Text>
            <Text style={[styles.subTitle, {color: Theme['fg-100']}]}>Signing</Text>
            <Text style={[styles.text, {color: Theme['fg-150']}]}>
              When the extension shows a QR code to sign, tap “Scan sign request” below, review the request and confirm.
              Show the resulting QR code to the extension.
            </Text>
          </View>

          <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
            <View style={styles.row}>
              <Text style={[styles.text, styles.flex, {color: Theme['fg-100']}]}>Show helper addresses</Text>
              <Switch value={showHelpers} onValueChange={setShowHelpers} />
            </View>
            {showHelpers &&
              pairing.helperAddresses.map((address, i) => (
                <View key={address} style={styles.helper}>
                  <Text style={[styles.small, {color: Theme['error-100']}]}>#{i + 2} - do not use</Text>
                  <Text style={[styles.mono, {color: Theme['fg-175']}]} selectable>
                    {address}
                  </Text>
                </View>
              ))}
          </View>

          <ActionButton style={styles.button} onPress={() => navigation.navigate('Scan')}>
            Scan sign request
          </ActionButton>
        </>
      )}

      <PinModal
        visible={showPassword}
        onSubmit={unlockSoftware}
        onCancel={() => setShowPassword(false)}
        title="Enter account password"
        minLength={8}
        maxLength={64}
        type="password"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    rowGap: 16,
    alignItems: 'stretch',
  },
  header: {
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  small: {
    fontSize: 12,
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
  },
  center: {
    textAlign: 'center',
  },
  strong: {
    fontWeight: '700',
  },
  mono: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    rowGap: 8,
  },
  important: {
    borderWidth: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  helper: {
    rowGap: 2,
    marginTop: 4,
  },
  button: {
    width: '100%',
    height: 48,
  },
});
