import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {RootStackScreenProps} from '@/utils/TypesUtil';
import SettingsStore from '@/store/SettingsStore';
import {SatochipInfo, WalletType} from '@/types/WalletTypes';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ActionButton} from '@/components/ActionButton';
import {buildSyncUR} from '@/airgap/syncPayload';
import {AnimatedUrQR} from './AnimatedUrQR';

type Props = RootStackScreenProps<'AirgapSync'>;

export default function SyncScreen({route, navigation}: Props) {
  const Theme = useTheme();
  const insets = useSafeAreaInsets();
  const {accountId} = route.params;
  const wallet = SettingsStore.getWallet(accountId);
  const info =
    wallet?.type === WalletType.SATOCHIP
      ? (wallet.getWalletInfo() as SatochipInfo)
      : undefined;

  const {ur, error} = useMemo(() => {
    if (!info) {
      return {ur: undefined, error: 'This account is not a Satochip account.'};
    }
    try {
      return {ur: buildSyncUR({masterXfp: info.masterXfp, xpub: info.xpub})};
    } catch (e: any) {
      console.warn('[Airgap] cannot build sync QR:', e?.message);
      return {ur: undefined, error: e?.message || 'Cannot build sync QR code'};
    }
  }, [info]);

  return (
    <ScrollView
      style={{backgroundColor: Theme['bg-100']}}
      contentContainerStyle={[styles.content, {paddingBottom: 16 + insets.bottom}]}>
      {info && (
        <View style={styles.header}>
          <Text style={[styles.name, {color: Theme['fg-100']}]}>{info.name}</Text>
          <Text style={[styles.small, {color: Theme['fg-175']}]}>
            Card {info.masterXfp} · m/44'/60'/0'/0/*
          </Text>
        </View>
      )}

      {ur ? (
        <AnimatedUrQR ur={ur} />
      ) : (
        <Text style={[styles.error, {color: Theme['error-100']}]}>{error}</Text>
      )}

      <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
        <Text style={[styles.cardTitle, {color: Theme['fg-100']}]}>How to connect</Text>
        <Text style={[styles.text, {color: Theme['fg-150']}]}>
          This QR code contains only the public key of your Satochip accounts (m/44'/60'/0'/0/i). Your
          private key never leaves the card.
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
          in Connections), review the request, then tap your Satochip card. Show the resulting QR code
          to the extension.
        </Text>
      </View>

      <ActionButton style={styles.button} onPress={() => navigation.navigate('Scan')}>
        Scan sign request
      </ActionButton>
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
