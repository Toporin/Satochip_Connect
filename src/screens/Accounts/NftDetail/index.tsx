import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { useSnapshot } from 'valtio';

import { useTheme } from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import Unknown from '@/assets/chains/unknown.png';
import type { NftEntry } from '@/services/NftService';
import styles from './styles';

// ─── External explorer URL helpers ───────────────────────────────────────────

const OPENSEA_NETWORK: Record<number, string> = {
  1:     'ethereum',
  56:    'bnb',
  137:   'matic',
  42161: 'arbitrum',
  8453:  'base',
  43114: 'avalanche',
  10:    'optimism',
};

const NFTSCAN_SUBDOMAIN: Record<number, string> = {
  1:     'www',
  56:    'bnb',
  137:   'polygon',
  42161: 'arbitrum',
  8453:  'base',
  43114: 'avax',
  10:    'optimism',
};

function openSeaUrl(chainId: number, contract: string, tokenId: string): string | null {
  const network = OPENSEA_NETWORK[chainId];
  if (!network) return null;
  return `https://opensea.io/assets/${network}/${contract}/${tokenId}`;
}

function nftScanUrl(chainId: number, contract: string, tokenId: string): string | null {
  const sub = NFTSCAN_SUBDOMAIN[chainId];
  if (!sub) return null;
  return `https://${sub}.nftscan.com/${contract}/${tokenId}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

type Props = AccountsStackScreenProps<'NftDetail'>;

export default function NftDetail({ route, navigation }: Props) {
  const Theme = useTheme();
  const { nftKey } = route.params;
  const [imageError, setImageError] = useState(false);

  const { nftBalances } = useSnapshot(SettingsStore.state);
  const nftEntry = useMemo(
    () => (nftBalances as Record<string, NftEntry>)[nftKey],
    [nftKey, nftBalances]
  );

  if (!nftEntry) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: Theme['bg-100'] }]}>
        <Text style={[styles.errorTitle, { color: Theme['fg-100'] }]}>
          NFT Not Found
        </Text>
        <Text style={[styles.errorDescription, { color: Theme['fg-150'] }]}>
          This NFT may have been transferred or data is not yet loaded.
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

  const displayName =
    nftEntry.name ||
    nftEntry.contractName ||
    `${nftEntry.contract.slice(0, 6)}…${nftEntry.contract.slice(-4)}`;

  const showBalance =
    nftEntry.tokenType === 'ERC1155' && parseInt(nftEntry.balance, 10) > 1;

  const osUrl = openSeaUrl(nftEntry.chainId, nftEntry.contract, nftEntry.tokenId);
  const nsUrl = nftScanUrl(nftEntry.chainId, nftEntry.contract, nftEntry.tokenId);

  const copyToClipboard = (value: string, label: string) => {
    Clipboard.setString(value);
    Toast.show({ type: 'success', text1: `${label} copied` });
  };

  const openUrl = async (url: string, label: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Toast.show({ type: 'error', text1: `Cannot open ${label}` });
      }
    } catch {
      Toast.show({ type: 'error', text1: `Failed to open ${label}` });
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={styles.content}>

      {/* NFT image */}
      <View style={styles.imageContainer}>
        <Image
          source={
            !imageError && nftEntry.imageUrl
              ? { uri: nftEntry.imageUrl }
              : Unknown
          }
          style={styles.nftImage}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      </View>

      {/* Name */}
      <Text style={[styles.nftName, { color: Theme['fg-100'] }]}>
        {displayName}
      </Text>

      {/* Token type badge */}
      <View
        style={[
          styles.tokenTypeBadge,
          { backgroundColor: Theme['accent-020'] },
        ]}>
        <Text style={[styles.tokenTypeText, { color: Theme['accent-100'] }]}>
          {nftEntry.tokenType}
        </Text>
      </View>

      {/* Contract info */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-200'] }]}>
          Contract
        </Text>
        <View style={[styles.infoCard, { backgroundColor: Theme['bg-175'] }]}>
          {nftEntry.contractName ? (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: Theme['fg-200'] }]}>Name</Text>
              <Text style={[styles.infoValue, { color: Theme['fg-100'] }]}>
                {nftEntry.contractName}
                {nftEntry.contractSymbol ? ` (${nftEntry.contractSymbol})` : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: Theme['fg-200'] }]}>Address</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(nftEntry.contract, 'Contract address')}
              activeOpacity={0.7}>
              <Text style={[styles.copyableValue, { color: Theme['accent-100'] }]}>
                {nftEntry.contract}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: Theme['fg-200'] }]}>Network</Text>
            <Text style={[styles.infoValue, { color: Theme['fg-100'] }]}>
              {nftEntry.chainName}
            </Text>
          </View>
        </View>
      </View>

      {/* Token info */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-200'] }]}>
          Token
        </Text>
        <View style={[styles.infoCard, { backgroundColor: Theme['bg-175'] }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: Theme['fg-200'] }]}>Token ID</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(nftEntry.tokenId, 'Token ID')}
              activeOpacity={0.7}>
              <Text style={[styles.copyableValue, { color: Theme['accent-100'] }]}>
                {nftEntry.tokenId}
              </Text>
            </TouchableOpacity>
          </View>

          {showBalance && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: Theme['fg-200'] }]}>Balance</Text>
              <Text style={[styles.infoValue, { color: Theme['fg-100'] }]}>
                {nftEntry.balance}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Description */}
      {nftEntry.description ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Theme['fg-200'] }]}>
            Description
          </Text>
          <View style={[styles.infoCard, { backgroundColor: Theme['bg-175'] }]}>
            <Text style={[styles.descriptionText, { color: Theme['fg-100'] }]}>
              {nftEntry.description}
            </Text>
          </View>
        </View>
      ) : null}

      {/* External links */}
      {(osUrl || nsUrl) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Theme['fg-200'] }]}>
            Explore
          </Text>
          <View style={styles.linksContainer}>
            {osUrl && (
              <TouchableOpacity
                style={[
                  styles.linkButton,
                  { backgroundColor: Theme['accent-100'] },
                ]}
                onPress={() => openUrl(osUrl, 'OpenSea')}
                activeOpacity={0.7}>
                <Text
                  style={[styles.linkButtonText, { color: Theme['inverse-100'] }]}>
                  OpenSea
                </Text>
              </TouchableOpacity>
            )}
            {nsUrl && (
              <TouchableOpacity
                style={[
                  styles.linkButton,
                  { backgroundColor: Theme['bg-250'] },
                ]}
                onPress={() => openUrl(nsUrl, 'NFTScan')}
                activeOpacity={0.7}>
                <Text
                  style={[styles.linkButtonText, { color: Theme['fg-100'] }]}>
                  NFTScan
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
