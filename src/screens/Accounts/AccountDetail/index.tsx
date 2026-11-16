import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { useSnapshot } from 'valtio';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import { SatochipInfo, SatodimeInfo, SatodimeVaultState, WalletType } from '@/types/WalletTypes';
import { SatodimeCard } from 'satochip-react-native';
import useSatochipModal from '@/hooks/useSatochipModal';
import NfcPrompt from '@/components/NfcPromptAndroid';
import { decodeSatodimeSlip44, SATODIME_VAULT_STATE_LABELS } from '@/constants/Satodime';
import { readSatodimeCardState, releaseSatodimeOwnership } from '@/wallets/satodime/SatodimeClient';
import { SecretStore } from '@/utils/SecretStore';
import { handleSatodimeError } from '@/wallets/satodime/satodimeNfc';
import BalanceTable from '@/components/BalanceTable';
import NftTable from '@/components/NftTable';
import { fetchBalancesForAllWallets } from '@/hooks/useBalanceFetching';
import { fetchTokenBalancesForAllWallets } from '@/hooks/useTokenBalanceFetching';
import { fetchNftBalancesForAllWallets } from '@/hooks/useNftFetching';
import type { BalanceEntry } from '@/services/BalanceService';
import type { TokenBalanceEntry } from '@/services/TokenService';
import type { NftEntry } from '@/services/NftService';
import { EIP155_CHAINS } from '@/constants/Eip155';
import styles from './styles';

type Props = AccountsStackScreenProps<'AccountDetails'>;

export default function AccountDetail({ route, navigation }: Props) {
  const Theme = useTheme();
  const accountId = route.params.accountId;

  // State
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Subscribe to store
  const { wallets, balances, tokenBalances, nftBalances } = useSnapshot(SettingsStore.state);

  // Get wallet
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wallet = useMemo(() => SettingsStore.getWallet(accountId), [accountId, wallets]);

  // Extract wallet info and type (must be called before any conditional returns)
  const walletInfo = useMemo(() => wallet?.getWalletInfo(), [wallet]);

  const isSatodime = wallet?.type === WalletType.SATODIME;
  const isHardware = useMemo(
    () => wallet?.type === WalletType.SATOCHIP || wallet?.type === WalletType.SATODIME,
    [wallet],
  );
  const satodimeInfo = isSatodime ? (walletInfo as SatodimeInfo) : undefined;
  const satodimeNetwork = satodimeInfo ? decodeSatodimeSlip44(satodimeInfo.slip44) : undefined;

  // Satodime ownership. CVC cards: the unlock code is engraved and never
  // changes, nothing to manage. Non-CVC cards: only the device that claimed
  // the card holds its unlock code (kept in the keychain).
  const satodimeAuthentikey = satodimeInfo?.authentikey;
  const [hasUnlockCode, setHasUnlockCode] = useState<boolean | undefined>(undefined);
  const refreshUnlockCode = useCallback(async () => {
    if (!satodimeAuthentikey) {
      return;
    }
    setHasUnlockCode(await SecretStore.hasSatodimeUnlockSecret(satodimeAuthentikey));
  }, [satodimeAuthentikey]);
  // re-read on focus: signing elsewhere can claim the card or delete its code
  useFocusEffect(
    useCallback(() => {
      refreshUnlockCode().catch(() => setHasUnlockCode(undefined));
    }, [refreshUnlockCode]),
  );
  const isNonCvcCard = satodimeInfo?.fixedUnlockSecret === false;
  /** Non-CVC card whose unlock code is not stored here: watch-only until this app claims it */
  const isNotOwner = isNonCvcCard && hasUnlockCode === false;
  const canReleaseOwnership = isNonCvcCard && hasUnlockCode === true;

  // Satodime: re-scan the card to refresh the vault state (e.g. after unsealing
  // it in the Satodime app), the CVC flag and the ownership
  const satodimeCard = useRef(new SatodimeCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(satodimeCard);
  const runWithSatodime = useCallback(
    async <T,>(operation: () => Promise<T>, errorTitle: string): Promise<T | undefined> => {
      try {
        const run = withModal(operation);
        if (!run) {
          throw new Error('NFC is not supported on this platform');
        }
        return (await run()) as T;
      } catch (error) {
        Toast.show({ type: 'error', text1: errorTitle, text2: handleSatodimeError(error) });
        return undefined;
      } finally {
        closeNfc();
        await satodimeCard.endNfcSession().catch(() => undefined);
      }
    },
    [closeNfc, satodimeCard, withModal],
  );

  const rescanSatodimeVault = useCallback(async () => {
    if (!satodimeInfo) {
      return;
    }
    const cardState = await runWithSatodime(
      () => readSatodimeCardState(satodimeCard, satodimeInfo),
      'Failed to read the card',
    );
    await refreshUnlockCode();
    if (!cardState) {
      return;
    }
    const { vaultState, fixedUnlockSecret, ownedByThisPhone, setupDone } = cardState;
    SettingsStore.updateSatodimeCardState(satodimeInfo.authentikey, {
      fixedUnlockSecret,
      cardHasOwner: setupDone,
      vaultStates: { [satodimeInfo.vaultIndex]: vaultState },
    });
    // non-CVC card owned by another app: cannot sign (nor unseal) until released there.
    // A sealed vault can send: it is unsealed, with the user's permission, when signing.
    const ownedElsewhere = !fixedUnlockSecret && setupDone && !ownedByThisPhone;
    Toast.show({
      type: ownedElsewhere ? 'info' : 'success',
      text1: `Vault #${satodimeInfo.vaultIndex + 1}: ${SATODIME_VAULT_STATE_LABELS[vaultState]}${ownedElsewhere ? ' · owned by another app' : ''}`,
      text2: ownedElsewhere ? 'This account stays watch-only.' : 'This account can send.',
    });
  }, [refreshUnlockCode, runWithSatodime, satodimeCard, satodimeInfo]);

  const releaseOwnership = useCallback(() => {
    if (!satodimeInfo) {
      return;
    }
    Alert.alert(
      'Release ownership?',
      'Anyone can then claim the card, and a new unlock code will be created. This phone will no longer be able to sign with any vault of this card until it claims it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            const done = await runWithSatodime(async () => {
              await releaseSatodimeOwnership(satodimeCard, satodimeInfo);
              return true;
            }, 'Failed to release ownership');
            await refreshUnlockCode();
            if (done) {
              Toast.show({ type: 'success', text1: 'Ownership released', text2: 'The card can now be claimed by another device.' });
            }
          },
        },
      ],
    );
  }, [refreshUnlockCode, runWithSatodime, satodimeCard, satodimeInfo]);

  // Filter token balances for this wallet address, by chainId (non-zero, no error)
  const addressTokenBalances = useMemo((): Map<number, TokenBalanceEntry[]> => {
    if (!walletInfo) return new Map();
    const walletAddress = walletInfo.address;
    const result = new Map<number, TokenBalanceEntry[]>();

    for (const [key, entry] of Object.entries(tokenBalances)) {
      if (key.startsWith(`${walletAddress}:`) && entry.balance !== '0' && !entry.error) {
        const chainId = (entry as TokenBalanceEntry).chainId;
        const bucket = result.get(chainId);
        if (bucket) {
          bucket.push(entry as TokenBalanceEntry);
        } else {
          result.set(chainId, [entry as TokenBalanceEntry]);
        }
      }
    }

    // Sort each chain's entries by USD value (highest first), then by name
    for (const [chainId, entries] of result) {
      result.set(chainId, entries.sort((a, b) => {
        if (a.usdValue !== undefined && b.usdValue !== undefined) {
          return b.usdValue - a.usdValue;
        }
        if (a.usdValue !== undefined) return -1;
        if (b.usdValue !== undefined) return 1;
        return a.name.localeCompare(b.name);
      }));
    }

    return result;
  }, [walletInfo, tokenBalances]);

  // Filter and group NFT balances for this wallet address by chainId
  const addressNftBalances = useMemo((): Map<number, NftEntry[]> => {
    if (!walletInfo) return new Map();
    const walletAddress = walletInfo.address;
    const result = new Map<number, NftEntry[]>();

    for (const [key, entry] of Object.entries(nftBalances)) {
      if (key.startsWith(`${walletAddress}:`)) {
        const chainId = (entry as NftEntry).chainId;
        const bucket = result.get(chainId);
        if (bucket) {
          bucket.push(entry as NftEntry);
        } else {
          result.set(chainId, [entry as NftEntry]);
        }
      }
    }

    // Sort each chain's entries by name
    for (const [chainId, entries] of result) {
      result.set(
        chainId,
        entries.sort((a, b) => {
          const nameA = a.name || a.contractName || a.contract;
          const nameB = b.name || b.contractName || b.contract;
          return nameA.localeCompare(nameB);
        })
      );
    }

    return result;
  }, [walletInfo, nftBalances]);

  // Filter and sort native balances for this wallet address.
  // Also includes zero-balance native entries for chains that have tokens.
  const addressBalances = useMemo(() => {
    if (!walletInfo) return [];  // Guard for undefined wallet

    const walletAddress = walletInfo.address;
    const allBalances: BalanceEntry[] = [];
    const includedChainIds = new Set<number>();

    // Add all non-zero native balances
    for (const [key, entry] of Object.entries(balances)) {
      if (key.startsWith(`${walletAddress}:`)) {
        if (entry.balance !== '0' && !entry.error) {
          allBalances.push(entry);
          includedChainIds.add(entry.chainId);
        }
      }
    }

    // Add zero-balance native entries for chains that have tokens but no native balance shown
    const tokenChainIds = new Set<number>();
    for (const key of Object.keys(tokenBalances)) {
      if (key.startsWith(`${walletAddress}:`)) {
        const parts = key.split(':');
        if (parts.length >= 2) {
          tokenChainIds.add(Number(parts[1]));
        }
      }
    }

    for (const chainId of tokenChainIds) {
      if (!includedChainIds.has(chainId)) {
        const nativeKey = `${walletAddress}:${chainId}`;
        const existing = (balances as Record<string, BalanceEntry>)[nativeKey];
        if (existing) {
          allBalances.push({ ...existing, error: undefined });
        } else {
          const chainKey = `eip155:${chainId}`;
          const chainInfo = EIP155_CHAINS[chainKey];
          allBalances.push({
            balance: '0',
            decimals: 18,
            timestamp: Date.now(),
            chainId,
            chainName: chainInfo?.name || `Chain ${chainId}`,
            symbol: chainInfo?.symbol || '',
          });
        }
        includedChainIds.add(chainId);
      }
    }

    // Sort by USD value (highest first), then by chainId (lowest first)
    return allBalances.sort((a, b) => {
      if (a.usdValue !== undefined && b.usdValue !== undefined) {
        return b.usdValue - a.usdValue;
      }
      if (a.usdValue !== undefined) return -1;
      if (b.usdValue !== undefined) return 1;
      return a.chainId - b.chainId;
    });
  }, [walletInfo, balances, tokenBalances]);

  // Get the best chainId for SendTransaction navigation
  const getDefaultChainId = useCallback((): number => {
    // Strategy 1: Use highest USD value balance's chainId
    if (addressBalances.length > 0 && addressBalances[0].usdValue !== undefined) {
      return addressBalances[0].chainId;
    }

    // Strategy 2: Use first balance's chainId (if USD values missing)
    if (addressBalances.length > 0) {
      return addressBalances[0].chainId;
    }

    // Strategy 3: Satodime vault network (from its SLIP-44), else Ethereum mainnet
    return satodimeNetwork?.defaultChainId ?? 1;
  }, [addressBalances, satodimeNetwork]);

  // Guard: wallet not found
  if (!wallet || !walletInfo) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: Theme['bg-100'] }]}>
        <Text style={[styles.errorTitle, { color: Theme['fg-100'] }]}>
          Account Not Found
        </Text>
        <Text style={[styles.errorDescription, { color: Theme['fg-150'] }]}>
          This account may have been deleted or does not exist.
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: Theme['accent-100'] }]}
          onPress={() => navigation.goBack()}>
          <Text style={[styles.errorButtonText, { color: Theme['inverse-100'] }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Handlers
  const copyToClipboard = (value: string, label: string) => {
    Clipboard.setString(value);
    Toast.show({
      type: 'success',
      text1: `${label} copied to clipboard`,
    });
  };

  const handleDeleteClick = async () => {
    // Satodime: the card ownership matters only when deleting the last account
    // of the card managed by the app; other accounts of the card keep using
    // the unlock code.
    const authentikey = satodimeInfo?.authentikey.toLowerCase();
    const isLastAccountOfCard =
      authentikey !== undefined &&
      !SettingsStore.getSatodimeWallets().some(
        w => w.id !== accountId && w.satodimeInfo.authentikey.toLowerCase() === authentikey,
      );
    if (satodimeInfo && isLastAccountOfCard) {
      // read the keychain now: the cached state may not be loaded yet
      const ownsCard = await SecretStore.hasSatodimeUnlockSecret(satodimeInfo.authentikey).catch(() => false);
      if (ownsCard && satodimeInfo.fixedUnlockSecret === undefined) {
        // account added before the card type was recorded
        Alert.alert(
          'Re-scan the card first',
          'This phone holds the unlock code of this Satodime card. Re-scan the card so the app can check whether its code is engraved on the card before deleting the account.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Re-scan card', onPress: rescanSatodimeVault },
          ],
        );
        return;
      }
      if (ownsCard && satodimeInfo.fixedUnlockSecret === false) {
        // non-CVC card owned here: its unlock code exists nowhere else
        Alert.alert(
          'Release ownership first',
          'This is the last account of this Satodime card in the app. This phone owns the card, and its unlock code exists only on this phone. Release the card ownership before deleting the account, otherwise nobody could manage the card anymore.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Release ownership', onPress: releaseOwnership },
          ],
        );
        return;
      }
    }
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setDeleteLoading(true);
    setShowDeleteModal(false);
    try {
      SettingsStore.removeWallet(accountId);
      Toast.show({
        type: 'success',
        text1: 'Account deleted successfully',
      });
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete account:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to delete account',
        text2: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // todo: fetch only current wallet?
      await Promise.all([
        fetchBalancesForAllWallets(),
        fetchTokenBalancesForAllWallets(),
        fetchNftBalancesForAllWallets(),
      ]);
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to refresh balances',
        text2: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleQRCodeClick = () => {
    setShowQRModal(true);
  };

  const handleExploreClick = async () => {
    const url = `https://blockscan.com/address/${walletInfo.address}`;
    try {
      // Open directly: on Android 11+ canOpenURL() returns false for https
      // links unless <queries> are declared in the manifest, even when a
      // browser is installed. openURL() rejects if nothing can handle it.
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to open browser',
        text2: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Helper to render info fields
  const renderInfoField = (label: string, value: string | undefined, copyable: boolean) => {
    if (!value) return null;
    return (
      <View style={styles.infoField}>
        <Text style={[styles.fieldLabel, { color: Theme['fg-150'] }]}>{label}</Text>
        {copyable ? (
          <TouchableOpacity onPress={() => copyToClipboard(value, label)} activeOpacity={0.7}>
            <Text style={[styles.fieldValue, styles.copyableValue, { color: Theme['accent-100'] }]}>
              {value}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.fieldValue, { color: Theme['fg-100'] }]}>{value}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Theme['bg-100'] }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Theme['accent-100']}
          colors={[Theme['accent-100']]}
        />
      }>
      <View style={styles.content}>
        {/* Header with name and type chip */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.accountName, { color: Theme['fg-100'] }]}>
              {walletInfo.name}
            </Text>
            <View
              style={[
                styles.accountTypeChip,
                { backgroundColor: isHardware ? Theme['accent-100'] : Theme['bg-250'] },
              ]}>
              <Text
                style={[
                  styles.accountTypeText,
                  { color: isHardware ? Theme['inverse-100'] : Theme['fg-150'] },
                ]}>
                {isSatodime ? 'Satodime' : isHardware ? 'Satochip' : 'Software'}
              </Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: Theme['bg-300'] }]} />

        {/* Base wallet info section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
            Wallet Information
          </Text>
          <View style={[styles.infoCard, { backgroundColor: Theme['bg-175'] }]}>
            {/*{renderInfoField('ID', walletInfo.id, true)}*/}
            {renderInfoField('Blockchain', walletInfo.blockchain.charAt(0).toUpperCase() + walletInfo.blockchain.slice(1), false)}
            {renderInfoField('Address', walletInfo.address, true)}
          </View>
        </View>

        {/* Balance section */}
        <BalanceTable addressBalances={addressBalances} addressTokenBalances={addressTokenBalances} />

        {/* NFT section */}
        <NftTable
          address={walletInfo.address}
          addressNftBalances={addressNftBalances}
          onNftPress={entry =>
            navigation.navigate('NftDetail', {
              nftKey: `${walletInfo.address}:${entry.chainId}:${entry.contract}:${entry.tokenId}`,
            })
          }
        />

        {/* Action buttons row */}
        <View style={styles.buttonRow}>

          {/* Send button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: Theme['accent-100'] }
            ]}
            onPress={() =>
              // Satodime: a sealed vault is unsealed (with permission) when signing
              navigation.navigate('SendTransaction', {
                accountId: accountId,
                chainId: getDefaultChainId(),
                chainIds: addressBalances.map(entry => entry.chainId),
              })
            }
            activeOpacity={0.7}>
            <Text style={[styles.actionButtonText, { color: Theme['inverse-100'] }]}>
              Send
            </Text>
          </TouchableOpacity>

          {/* QR Code button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: Theme['accent-100'] }
            ]}
            onPress={handleQRCodeClick}
            activeOpacity={0.7}>
            <Text style={[styles.actionButtonText, { color: Theme['inverse-100'] }]}>
              QR Code
            </Text>
          </TouchableOpacity>

          {/* Explore button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: Theme['accent-100'] }
            ]}
            onPress={handleExploreClick}
            activeOpacity={0.7}>
            <Text style={[styles.actionButtonText, { color: Theme['inverse-100'] }]}>
              Explore
            </Text>
          </TouchableOpacity>
        </View>

        {/* Airgap QR code: pair with browser extensions (MetaMask, Rabby...) */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Theme['accent-100'] }]}
            onPress={() =>
              // Satodime vaults hold a single key (crypto-account); Satochip and
              // software accounts share an xpub (crypto-hdkey; the screen redirects
              // private-key software accounts to the single-key pairing)
              isSatodime
                ? navigation.navigate('AirgapSingleKeySync', { accountId })
                : navigation.navigate('AirgapSync', { accountId })
            }
            activeOpacity={0.7}>
            <Text style={[styles.actionButtonText, { color: Theme['inverse-100'] }]}>
              Connect to browser extension (QR)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hardware-specific section (conditional on wallet type) */}
        {isHardware && 'masterXfp' in walletInfo && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
              Satochip Details
            </Text>
            <View style={[styles.infoCard, { backgroundColor: Theme['bg-175'] }]}>
              {renderInfoField('Master Fingerprint', (walletInfo as SatochipInfo).masterXfp, true)}
              {renderInfoField('Derivation Path', (walletInfo as SatochipInfo).derivationPath, true)}
              {renderInfoField('xPub', (walletInfo as SatochipInfo).xpub, true)}
            </View>
          </View>
        )}

        {/* Satodime vault details */}
        {satodimeInfo && satodimeNetwork && (
          <View style={styles.section}>
            <NfcPrompt visible={nfcVisible} close={closeNfc} />
            <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
              Satodime Details
            </Text>
            <View style={[styles.infoCard, { backgroundColor: Theme['bg-175'] }]}>
              {renderInfoField('Network', satodimeNetwork.label, false)}
              {renderInfoField('Vault', `#${satodimeInfo.vaultIndex + 1}`, false)}
              {renderInfoField('State', SATODIME_VAULT_STATE_LABELS[satodimeInfo.vaultState], false)}
              {isNotOwner ? renderInfoField('Ownership', 'Watch-only', false) : null}
              {satodimeInfo.cardLabel ? renderInfoField('Card label', satodimeInfo.cardLabel, false) : null}
              {renderInfoField('Card authentikey', satodimeInfo.authentikey, true)}
            </View>
            {satodimeInfo.vaultState === SatodimeVaultState.UNSEALED && (
              <Text style={[styles.sectionTitle, styles.satodimeWarning, { color: Theme['error-100'] }]}>
                ⚠ Unsealed vault: anyone holding the card can spend from it.
              </Text>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.airgapButton, { backgroundColor: Theme['accent-100'] }]}
              onPress={rescanSatodimeVault}
              activeOpacity={0.7}>
              <Text style={[styles.actionButtonText, { color: Theme['inverse-100'] }]}>
                Re-scan card
              </Text>
            </TouchableOpacity>
            {canReleaseOwnership && (
              <TouchableOpacity
                style={[styles.actionButton, styles.airgapButton, { backgroundColor: Theme['bg-250'] }]}
                onPress={releaseOwnership}
                activeOpacity={0.7}>
                <Text style={[styles.actionButtonText, { color: Theme['fg-100'] }]}>
                  Release ownership
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Delete section */}
        <View style={styles.deleteSection}>
          <View style={[styles.divider, { backgroundColor: Theme['bg-300'] }]} />

          {/* Delete button */}
          <TouchableOpacity
            style={[
              styles.deleteButton,
              {
                backgroundColor: deleteLoading ? Theme['bg-250'] : Theme['error-100'],
              },
            ]}
            onPress={handleDeleteClick}
            disabled={deleteLoading}
            activeOpacity={0.7}>
            {deleteLoading ? (
              <ActivityIndicator color={Theme['inverse-100']} />
            ) : (
              <Text
                style={[
                  styles.deleteButtonText,
                  {
                    color: deleteLoading ? Theme['fg-300'] : Theme['inverse-100'],
                  },
                ]}>
                Delete Account
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Theme['bg-100'] }]}>
            <Text style={[styles.modalTitle, { color: Theme['fg-100'] }]}>
              Delete Account
            </Text>
            <Text style={[styles.modalSubtitle, { color: Theme['fg-150'] }]}>
              Are you sure you want to permanently delete this {isHardware ? 'hardware' : 'software'} wallet account? This action cannot be undone.
            </Text>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalSecondaryButton, { backgroundColor: Theme['bg-250'] }]}
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.7}>
                <Text style={[styles.modalSecondaryButtonText, { color: Theme['fg-100'] }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryButton, { backgroundColor: Theme['error-100'] }]}
                onPress={confirmDelete}
                activeOpacity={0.7}>
                <Text style={[styles.modalPrimaryButtonText, { color: Theme['inverse-100'] }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModalContent, { backgroundColor: Theme['bg-100'] }]}>
            <Text style={[styles.modalTitle, { color: Theme['fg-100'] }]}>
              Account Address
            </Text>

            {/* QR Code */}
            <View style={styles.qrCodeContainer}>
              <QRCode
                value={walletInfo.address}
                size={200}
                backgroundColor="white"
                color="black"
              />
            </View>

            {/* Address with copy action */}
            <TouchableOpacity
              onPress={() => copyToClipboard(walletInfo.address, 'Address')}
              activeOpacity={0.7}
              style={styles.addressContainer}>
              <Text style={[styles.qrAddressText, { color: Theme['accent-100'] }]}>
                {walletInfo.address}
              </Text>
              <Text style={[styles.tapToCopy, { color: Theme['fg-150'] }]}>
                Tap to copy
              </Text>
            </TouchableOpacity>

            {/* Close button */}
            <TouchableOpacity
              style={[styles.qrCloseButton, { backgroundColor: Theme['accent-100'] }]}
              onPress={() => setShowQRModal(false)}
              activeOpacity={0.7}>
              <Text style={[styles.qrCloseButtonText, { color: Theme['inverse-100'] }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
