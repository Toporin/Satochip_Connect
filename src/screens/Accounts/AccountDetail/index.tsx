import React, { useState, useMemo, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Linking,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { useSnapshot } from 'valtio';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import { SatochipInfo, WalletType } from '@/types/WalletTypes';
import BalanceTable from '@/components/BalanceTable';
import { fetchBalancesForAllWallets } from '@/hooks/useBalanceFetching';
import { BalanceEntry } from '@/services/BalanceService';
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
  const { wallets, balances } = useSnapshot(SettingsStore.state);

  // Get wallet
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wallet = useMemo(() => SettingsStore.getWallet(accountId), [accountId, wallets]);

  // Guard: wallet not found
  if (!wallet) {
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

  const walletInfo = wallet.getWalletInfo();
  const isHardware = wallet.type === WalletType.SATOCHIP;

  // Filter and sort balances for this wallet address
  const addressBalances = useMemo(() => {
    const walletAddress = walletInfo.address;
    const allBalances: BalanceEntry[] = [];

    // Filter balances for this address
    for (const [key, entry] of Object.entries(balances)) {
      if (key.startsWith(`${walletAddress}:`)) {
        // Only include non-zero balances without errors
        if (entry.balance !== '0' && !entry.error) {
          allBalances.push(entry);
        }
      }
    }

    // Sort by USD value (highest first), then by chain name
    return allBalances.sort((a, b) => {
      if (a.usdValue !== undefined && b.usdValue !== undefined) {
        return b.usdValue - a.usdValue;
      }
      if (a.usdValue !== undefined) return -1;
      if (b.usdValue !== undefined) return 1;
      return a.chainName.localeCompare(b.chainName);
    });
  }, [walletInfo.address, balances]);

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

    // Strategy 3: Fallback to Ethereum mainnet
    return 1;
  }, [addressBalances]);

  // Handlers
  const copyToClipboard = (value: string, label: string) => {
    Clipboard.setString(value);
    Toast.show({
      type: 'success',
      text1: `${label} copied to clipboard`,
    });
  };

  const handleDeleteClick = () => {
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
      await fetchBalancesForAllWallets();
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
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Cannot open URL',
          text2: 'Browser not available',
        });
      }
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
                {isHardware ? 'Hardware' : 'Software'}
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
        <BalanceTable addressBalances={addressBalances} />

        {/* Action buttons row */}
        <View style={styles.buttonRow}>

          {/* Send button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: Theme['accent-100'] }
            ]}
            onPress={() => navigation.navigate('SendTransaction', {
              accountId: accountId,
              chainId: getDefaultChainId(),
              chainIds: addressBalances.map(entry => entry.chainId),
            })}
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

        {/* Hardware-specific section (conditional on wallet type) */}
        {isHardware && 'masterXfp' in walletInfo && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
              Hardware Details
            </Text>
            <View style={[styles.infoCard, { backgroundColor: Theme['bg-175'] }]}>
              {renderInfoField('Master Fingerprint', (walletInfo as SatochipInfo).masterXfp, true)}
              {renderInfoField('Derivation Path', (walletInfo as SatochipInfo).derivationPath, true)}
              {renderInfoField('xPub', (walletInfo as SatochipInfo).xpub, true)}
            </View>
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
