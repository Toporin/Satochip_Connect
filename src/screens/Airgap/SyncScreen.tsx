import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {RootStackScreenProps} from '@/utils/TypesUtil';
import SettingsStore from '@/store/SettingsStore';
import {SatochipInfo, WalletType} from '@/types/WalletTypes';
import {EIP155SoftwareWallet} from '@/wallets/EIP155SoftwareWallet';
import {PinModal} from '@/components/Modal/PinModal';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ActionButton} from '@/components/ActionButton';
import {buildSyncUR, SYNC_KEY_NAME} from '@/airgap/syncPayload';

/** Device name shown by the extensions for software (BIP39) accounts. */
const SOFTWARE_HD_DEVICE_NAME = 'SC Software';
import {AnimatedUrQR} from './AnimatedUrQR';

type Props = RootStackScreenProps<'AirgapSync'>;

export default function SyncScreen({route, navigation}: Props) {
  const Theme = useTheme();
  const insets = useSafeAreaInsets();
  const {accountId} = route.params;
  const wallet = SettingsStore.getWallet(accountId);
  const isSoftware = wallet instanceof EIP155SoftwareWallet;

  const [showPassword, setShowPassword] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  // bumped after a software unlock records the pairing data
  const [dataVersion, setDataVersion] = useState(0);

  // Satochip account, or software (BIP39) account: same crypto-hdkey layout
  const info = useMemo((): {name: string; masterXfp: string; xpub: string; deviceName: string; path?: string} | undefined => {
    if (wallet?.type === WalletType.SATOCHIP) {
      const satochip = wallet.getWalletInfo() as SatochipInfo;
      return {name: satochip.name, masterXfp: satochip.masterXfp, xpub: satochip.xpub, deviceName: SYNC_KEY_NAME};
    }
    if (wallet instanceof EIP155SoftwareWallet) {
      const software = wallet.getWalletInfo();
      if (software.xpub && software.masterXfp) {
        return {
          name: software.name,
          masterXfp: software.masterXfp,
          xpub: software.xpub,
          deviceName: SOFTWARE_HD_DEVICE_NAME,
          path: software.derivationPath,
        };
      }
    }
    return undefined;
    // dataVersion: recompute once the software pairing data is recorded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, dataVersion]);

  // Private-key software accounts have no xpub: they pair with crypto-account
  const isPrivateKeyAccount = wallet instanceof EIP155SoftwareWallet && wallet.getWalletInfo().keyType === 'privateKey';
  useEffect(() => {
    if (isPrivateKeyAccount) {
      navigation.replace('AirgapSingleKeySync', {accountId});
    }
  }, [accountId, isPrivateKeyAccount, navigation, dataVersion]);

  const needsSoftwareUnlock = isSoftware && !info && !isPrivateKeyAccount;

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
        setDataVersion(v => v + 1);
      } catch {
        setUnlockError('Wrong password, or the account could not be unlocked.');
      }
    },
    [wallet],
  );

  const {ur, error} = useMemo(() => {
    if (!info) {
      return {ur: undefined, error: isSoftware ? undefined : 'This account cannot be paired with this QR code.'};
    }
    try {
      return {ur: buildSyncUR({masterXfp: info.masterXfp, xpub: info.xpub}, info.deviceName)};
    } catch (e: any) {
      console.warn('[Airgap] cannot build sync QR:', e?.message);
      return {ur: undefined, error: e?.message || 'Cannot build sync QR code'};
    }
  }, [info, isSoftware]);

  const accountIndex = info?.path ? Number(info.path.split('/').pop()) : undefined;

  return (
    <ScrollView
      style={{backgroundColor: Theme['bg-100']}}
      contentContainerStyle={[styles.content, {paddingBottom: 16 + insets.bottom}]}>
      {info && (
        <View style={styles.header}>
          <Text style={[styles.name, {color: Theme['fg-100']}]}>{info.name}</Text>
          <Text style={[styles.small, {color: Theme['fg-175']}]}>
            {isSoftware ? 'Seed' : 'Card'} {info.masterXfp} · m/44'/60'/0'/0/* · shown as “{info.deviceName}”
          </Text>
        </View>
      )}

      {needsSoftwareUnlock && (
        <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
          <Text style={[styles.text, {color: Theme['fg-150']}]}>
            To create the pairing QR code, the public key of this account's seed (xpub) is needed once. Enter the
            account password: only public data is saved.
          </Text>
          {unlockError && <Text style={[styles.text, {color: Theme['error-100']}]}>{unlockError}</Text>}
          <ActionButton style={styles.button} onPress={() => setShowPassword(true)}>
            Enter password
          </ActionButton>
        </View>
      )}

      {ur ? (
        <AnimatedUrQR ur={ur} />
      ) : error ? (
        <Text style={[styles.error, {color: Theme['error-100']}]}>{error}</Text>
      ) : null}

      {isSoftware && info && accountIndex !== undefined && (
        <Text style={[styles.text, {color: Theme['fg-100']}]}>
          In the extension, select address #{accountIndex + 1} ({wallet?.address.slice(0, 6)}…{wallet?.address.slice(-4)}): it
          is this account. Other addresses of the same seed can only sign if you add them in this app too.
        </Text>
      )}

      <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
        <Text style={[styles.cardTitle, {color: Theme['fg-100']}]}>How to connect</Text>
        <Text style={[styles.text, {color: Theme['fg-150']}]}>
          {isSoftware
            ? "This QR code contains only the public key (xpub) of this seed's accounts (m/44'/60'/0'/0/i). Your seed and private keys stay encrypted in this app."
            : 'This QR code contains only the public key of your Satochip accounts (m/44\'/60\'/0\'/0/i). Your private key never leaves the card.'}
        </Text>
        <Text style={[styles.subTitle, {color: Theme['fg-100']}]}>MetaMask</Text>
        <Text style={[styles.text, {color: Theme['fg-150']}]}>
          Account menu → Add account or hardware wallet → Hardware wallet → QR-based → Continue, then
          show this QR code to your computer's camera and pick the account(s) to add.
        </Text>
        <Text style={[styles.subTitle, {color: Theme['fg-100']}]}>Rabby</Text>
        <Text style={[styles.text, {color: Theme['fg-150']}]}>
          Add address → Connect hardware wallet → Keystone / QR-based wallet, then scan this QR code.
        </Text>
        <Text style={[styles.subTitle, {color: Theme['fg-100']}]}>Signing</Text>
        <Text style={[styles.text, {color: Theme['fg-150']}]}>
          When the extension shows a QR code to sign, tap "Scan sign request" below (or the scan button
          in Connections), review the request, then {isSoftware ? 'enter the account password' : 'tap your Satochip card'}. Show the
          resulting QR code to the extension.
        </Text>
      </View>

      <ActionButton style={styles.button} onPress={() => navigation.navigate('Scan')}>
        Scan sign request
      </ActionButton>

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
    marginTop: 4,
  },
  error: {
    textAlign: 'center',
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    rowGap: 6,
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
  text: {
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    width: '100%',
    height: 48,
  },
});
