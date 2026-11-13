import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SatochipCard, SatodimeCard} from 'satochip-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackScreenProps} from '@/utils/TypesUtil';
import {useTheme} from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import {SatodimeInfo, WalletError, WalletType} from '@/types/WalletTypes';
import {SatochipWallet} from '@/wallets/satochip/SatochipWallet';
import {EIP155SoftwareWallet} from '@/wallets/EIP155SoftwareWallet';
import {signDigestWithSatodime} from '@/wallets/satodime/SatodimeClient';
import {PresetsUtil} from '@/utils/PresetsUtil';
import {ActionButton} from '@/components/ActionButton';
import {Chains} from '@/components/Modal/Chains';
import {Addresses} from '@/components/Modal/Addresses';
import {Message} from '@/components/Modal/Message';
import {PinModal} from '@/components/Modal/PinModal';
import NfcPrompt from '@/components/NfcPromptAndroid';
import useSatochipModal from '@/hooks/useSatochipModal';
import {
  AirgapAccount,
  AirgapError,
  ParsedSignRequest,
  parseSignRequestUR,
} from '@/airgap/signRequest';
import {getAirgapAccounts} from '@/airgap/storeAccounts';
import {buildEthSignature} from '@/airgap/signatureResponse';
import {AirgapSignature, finalizeRawSignature, finalizeSignature} from '@/airgap/signing';

type Props = RootStackScreenProps<'AirgapReview'>;

function errorMessage(e: unknown): string {
  if (e instanceof WalletError && e.originalError?.message) {
    return e.originalError.message;
  }
  return (e as Error)?.message || String(e);
}

export default function ReviewScreen({route, navigation}: Props) {
  const Theme = useTheme();
  const insets = useSafeAreaInsets();
  const {cborHex, urType} = route.params;

  const [showPinModal, setShowPinModal] = useState(false);
  const [signing, setSigning] = useState(false);

  const {parsed, error} = useMemo((): {
    parsed?: ParsedSignRequest<AirgapAccount>;
    error?: string;
  } => {
    try {
      // Satochip accounts (xfp + path) and single-key accounts (Satodime, software)
      const p = parseSignRequestUR({type: urType, cbor: Buffer.from(cborHex, 'hex')}, getAirgapAccounts());
      console.info(
        `[Airgap] sign request ${p.requestIdString ?? '(no id)'} type=${p.dataType} path=${p.derivationPath} chain=${p.chainId ?? '-'} origin=${p.origin ?? '-'} hash=${p.hash.slice(0, 18)}…`,
      );
      return {parsed: p};
    } catch (e) {
      const msg = e instanceof AirgapError ? e.message : `Invalid request: ${errorMessage(e)}`;
      console.warn(`[Airgap] rejected sign request: ${e instanceof AirgapError ? e.code : 'ERROR'} ${msg}`);
      return {error: msg};
    }
  }, [cborHex, urType]);

  const chain = parsed?.chainId ? PresetsUtil.getChainData(`eip155:${parsed.chainId}`) : undefined;

  const wallet = parsed ? SettingsStore.getWallet(parsed.account.id) : undefined;
  const walletType = wallet?.type;
  // NFC card for hardware accounts (Satodime vaults use a SatodimeCard, no PIN)
  const card = useRef<SatochipCard | SatodimeCard>(
    walletType === WalletType.SATODIME ? new SatodimeCard() : new SatochipCard(),
  ).current;
  const {withModal, nfcVisible, closeNfc} = useSatochipModal(card);

  /** Run a card operation with the NFC prompt. */
  const withCard = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      const run = withModal(operation);
      if (!run) {
        throw new Error('NFC is not supported on this platform');
      }
      return (await run()) as T;
    },
    [withModal],
  );

  const performSign = useCallback(
    async (pin: string) => {
      if (!parsed || !wallet) {
        Alert.alert('Error', 'Account not found.');
        return;
      }
      const {hash, dataType, chainId, account} = parsed;
      setSigning(true);
      try {
        let sig: AirgapSignature;
        if (wallet instanceof SatochipWallet) {
          sig = await withCard(() =>
            wallet.signHashForAirgap(hash, card as SatochipCard, pin, dataType, chainId),
          );
        } else if (wallet.type === WalletType.SATODIME) {
          // card, vault key and unsealed-state checks happen in signDigestWithSatodime
          const info = wallet.getWalletInfo() as SatodimeInfo;
          const der = await withCard(() =>
            signDigestWithSatodime(card as SatodimeCard, info, Buffer.from(hash.slice(2), 'hex')),
          );
          sig = await finalizeSignature(hash, der, account.address, dataType, chainId);
        } else if (wallet instanceof EIP155SoftwareWallet) {
          if (!(await wallet.isAvailable())) {
            await wallet.unlockWallet(pin);
            SettingsStore.rememberSoftwarePublicKeys();
          }
          const {r, s} = wallet.signDigest(hash);
          sig = await finalizeRawSignature(hash, r, s, account.address, dataType, chainId);
        } else {
          throw new Error('Unsupported account type');
        }
        const response = buildEthSignature(parsed.requestId, sig);
        console.info(`[Airgap] signed request ${parsed.requestIdString ?? '(no id)'}`);
        navigation.replace('AirgapSignature', {
          cborHex: response.toCBOR().toString('hex'),
          summary: `${parsed.display.title} · ${parsed.account.name}`,
        });
      } catch (e) {
        const msg = errorMessage(e);
        console.warn(`[Airgap] signing failed: ${msg}`);
        Alert.alert('Signing failed', msg, [{text: 'OK'}]);
      } finally {
        if (walletType === WalletType.SATOCHIP || walletType === WalletType.SATODIME) {
          closeNfc();
          try {
            await card.endNfcSession();
          } catch {
            // session may already be closed
          }
        }
        setSigning(false);
      }
    },
    [parsed, wallet, walletType, withCard, card, closeNfc, navigation],
  );

  /** Satochip: PIN. Software: password unless already unlocked. Satodime: no PIN. */
  const onApprove = useCallback(async () => {
    if (walletType === WalletType.SATOCHIP) {
      setShowPinModal(true);
    } else if (walletType === WalletType.SOFTWARE && !(await wallet?.isAvailable())) {
      setShowPinModal(true);
    } else {
      performSign('');
    }
  }, [performSign, wallet, walletType]);

  const isSoftware = walletType === WalletType.SOFTWARE;
  const signLabel =
    walletType === WalletType.SATODIME ? 'Sign with Satodime' : isSoftware ? 'Sign' : 'Sign with Satochip';

  const onPinSubmit = useCallback(
    (pin: string) => {
      setShowPinModal(false);
      performSign(pin);
    },
    [performSign],
  );

  if (!parsed) {
    return (
      <View
        style={[
          styles.errorContainer,
          {backgroundColor: Theme['bg-100'], paddingBottom: 24 + insets.bottom},
        ]}>
        <Text style={[styles.errorTitle, {color: Theme['error-100']}]}>Cannot sign this request</Text>
        <Text style={[styles.text, {color: Theme['fg-150']}]}>{error}</Text>
        <ActionButton style={styles.fullButton} onPress={() => navigation.goBack()}>
          Back
        </ActionButton>
      </View>
    );
  }

  const {display} = parsed;

  return (
    <View style={[styles.flex, {backgroundColor: Theme['bg-100']}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, {color: Theme['fg-100']}]}>{display.title}</Text>
        <Text style={[styles.text, {color: Theme['fg-175']}]}>
          Requested by {parsed.origin || 'an air-gapped wallet (QR)'}
        </Text>

        {display.undecodable && (
          <View style={[styles.warning, {borderColor: Theme['error-100']}]}>
            <Text style={[styles.warningText, {color: Theme['error-100']}]}>
              ⚠ You are signing data that cannot be fully decoded. Only continue if you trust the
              request source.
            </Text>
          </View>
        )}
        {display.warnings.map(w => (
          <View key={w} style={[styles.warning, {borderColor: Theme['error-100']}]}>
            <Text style={[styles.warningText, {color: Theme['error-100']}]}>⚠ {w}</Text>
          </View>
        ))}

        {chain ? <Chains chains={[chain]} /> : null}
        <Addresses addresses={[parsed.account.address]} />

        <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
          <Field label="Account" value={`${parsed.account.name} (${parsed.derivationPath})`} />
          {display.fields.map((f, i) => (
            <Field key={`${f.label}-${i}`} label={f.label} value={f.value} />
          ))}
        </View>

        {display.body ? (
          <>
            <Text style={[styles.small, {color: Theme['fg-175']}]}>
              {display.bodyLabel ?? 'Data'}
            </Text>
            <Message message={display.body} style={styles.message} showTitle={false} />
          </>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {borderColor: Theme['bg-300'], paddingBottom: 16 + insets.bottom},
        ]}>
        <ActionButton
          secondary
          style={styles.halfButton}
          disabled={signing}
          onPress={() => {
            console.info(`[Airgap] request ${parsed.requestIdString ?? '(no id)'} rejected by user`);
            navigation.goBack();
          }}>
          Reject
        </ActionButton>
        <ActionButton
          style={styles.halfButton}
          loading={signing}
          onPress={onApprove}>
          {signLabel}
        </ActionButton>
      </View>

      <PinModal
        visible={showPinModal}
        onSubmit={onPinSubmit}
        onCancel={() => setShowPinModal(false)}
        title={isSoftware ? 'Enter password to sign' : 'Enter PIN to sign'}
        minLength={isSoftware ? 8 : 4}
        maxLength={isSoftware ? 64 : 16}
        type={isSoftware ? 'password' : 'PIN'}
      />
      <NfcPrompt visible={nfcVisible} close={closeNfc} />
    </View>
  );
}

function Field({label, value}: {label: string; value: string}) {
  const Theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, {color: Theme['fg-175']}]}>{label}</Text>
      <Text style={[styles.fieldValue, {color: Theme['fg-100']}]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    rowGap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
  },
  small: {
    fontSize: 11,
  },
  warning: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    padding: 12,
    rowGap: 8,
  },
  field: {
    rowGap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 13,
  },
  message: {
    maxHeight: 280,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  halfButton: {
    flex: 1,
    height: 48,
    width: undefined,
  },
  fullButton: {
    width: '100%',
    height: 48,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
