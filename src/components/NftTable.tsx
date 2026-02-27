import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useSnapshot } from 'valtio';

import { useTheme } from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import { EIP155_NETWORK_IMAGES } from '@/constants/Eip155';
import Unknown from '@/assets/chains/unknown.png';
import type { NftEntry } from '@/services/NftService';

interface NftTableProps {
  address: string;
  addressNftBalances: Map<number, NftEntry[]>;
  onNftPress: (entry: NftEntry) => void;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NftRow({
  entry,
  onPress,
}: {
  entry: NftEntry;
  onPress: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const Theme = useTheme();

  const displayName =
    entry.name ||
    entry.contractName ||
    `${entry.contract.slice(0, 6)}…${entry.contract.slice(-4)}`;
  const showCount =
    entry.tokenType === 'ERC1155' && parseInt(entry.balance, 10) > 1;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.nftRow, { backgroundColor: Theme['bg-200'] }]}
      activeOpacity={0.7}>
      {/* Thumbnail */}
      <Image
        source={
          !imageError && entry.thumbnailUrl
            ? { uri: entry.thumbnailUrl }
            : Unknown
        }
        style={styles.nftThumbnail}
        onError={() => setImageError(true)}
      />

      {/* Name and optional count */}
      <View style={styles.nftInfo}>
        <Text
          style={[styles.nftName, { color: Theme['fg-100'] }]}
          numberOfLines={2}>
          {displayName}
        </Text>
        {showCount && (
          <View
            style={[styles.countBadge, { backgroundColor: Theme['bg-250'] }]}>
            <Text style={[styles.countText, { color: Theme['fg-150'] }]}>
              ×{entry.balance}
            </Text>
          </View>
        )}
      </View>

      {/* Arrow hint */}
      <Text style={[styles.nftArrow, { color: Theme['fg-200'] }]}>›</Text>
    </TouchableOpacity>
  );
}

function ChainSection({
  chainId,
  nfts,
  isCollapsed,
  onToggle,
  onNftPress,
}: {
  chainId: number;
  nfts: NftEntry[];
  isCollapsed: boolean;
  onToggle: () => void;
  onNftPress: (entry: NftEntry) => void;
}) {
  const Theme = useTheme();
  const chainKey = `eip155:${chainId}`;
  const chainImage = EIP155_NETWORK_IMAGES[chainKey];
  const chainName = nfts[0]?.chainName || `Chain ${chainId}`;

  return (
    <View>
      {/* Chain header row — tap to expand / collapse */}
      <TouchableOpacity
        onPress={onToggle}
        style={styles.chainRow}
        activeOpacity={0.7}>
        <View style={styles.chainInfo}>
          <Image
            source={chainImage || Unknown}
            style={styles.chainIcon}
          />
          <Text style={[styles.chainName, { color: Theme['fg-100'] }]}>
            {chainName}
          </Text>
          <View
            style={[styles.nftCountChip, { backgroundColor: Theme['bg-250'] }]}>
            <Text style={[styles.nftCountChipText, { color: Theme['fg-150'] }]}>
              {nfts.length}
            </Text>
          </View>
        </View>
        <Text style={[styles.chevron, { color: Theme['fg-150'] }]}>
          {isCollapsed ? '▶' : '▼'}
        </Text>
      </TouchableOpacity>

      {/* NFT list */}
      {!isCollapsed && (
        <View style={styles.nftList}>
          {nfts.map(entry => (
            <NftRow
              key={`${entry.contract}:${entry.tokenId}`}
              entry={entry}
              onPress={() => onNftPress(entry)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NftTable({
  address: _address,
  addressNftBalances,
  onNftPress,
}: NftTableProps) {
  const Theme = useTheme();
  const { nftBalancesLoading, nftBalancesError } = useSnapshot(SettingsStore.state);

  // Track which chains are collapsed (default: all expanded)
  const [collapsedChains, setCollapsedChains] = useState<Set<number>>(
    new Set()
  );

  const toggleChain = (chainId: number) => {
    setCollapsedChains(prev => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        next.delete(chainId);
      } else {
        next.add(chainId);
      }
      return next;
    });
  };

  // Sort chain IDs from lowest to highest
  const sortedChainIds = React.useMemo(
    () => Array.from(addressNftBalances.keys()).sort((a, b) => a - b),
    [addressNftBalances]
  );

  const hasContent = sortedChainIds.length > 0;

  // Loading state (first load, no content yet)
  if (nftBalancesLoading && !hasContent) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
          NFTs
        </Text>
        <View
          style={[styles.loadingContainer, { backgroundColor: Theme['bg-175'] }]}>
          <ActivityIndicator size="large" color={Theme['accent-100']} />
          <Text style={[styles.loadingText, { color: Theme['fg-150'] }]}>
            Fetching NFTs…
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (nftBalancesError && !hasContent) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
          NFTs
        </Text>
        <View
          style={[styles.errorContainer, { backgroundColor: Theme['bg-175'] }]}>
          <Text style={[styles.errorText, { color: Theme['error-100'] }]}>
            {nftBalancesError}
          </Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (!hasContent) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
          NFTs
        </Text>
        <View
          style={[styles.emptyContainer, { backgroundColor: Theme['bg-175'] }]}>
          <Text style={[styles.emptyText, { color: Theme['fg-150'] }]}>
            No NFTs found
          </Text>
          <Text style={[styles.emptySubtext, { color: Theme['fg-200'] }]}>
            This address has no NFTs on supported chains
          </Text>
        </View>
      </View>
    );
  }

  // Main table
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
        NFTs
      </Text>

      <View style={[styles.nftCard, { backgroundColor: Theme['bg-175'] }]}>
        {sortedChainIds.map((chainId, idx) => {
          const nfts = addressNftBalances.get(chainId) || [];
          const isLastChain = idx === sortedChainIds.length - 1;

          return (
            <View key={chainId}>
              <ChainSection
                chainId={chainId}
                nfts={nfts}
                isCollapsed={collapsedChains.has(chainId)}
                onToggle={() => toggleChain(chainId)}
                onNftPress={onNftPress}
              />
              {!isLastChain && (
                <View
                  style={[
                    styles.chainDivider,
                    { backgroundColor: Theme['bg-300'] },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Refreshing indicator */}
      {nftBalancesLoading && (
        <View style={styles.refreshingContainer}>
          <ActivityIndicator size="small" color={Theme['accent-100']} />
          <Text style={[styles.refreshingText, { color: Theme['fg-150'] }]}>
            Updating…
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  nftCard: {
    borderRadius: 12,
    padding: 12,
  },
  // Chain row
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  chainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chainIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
  },
  chainName: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  nftCountChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  nftCountChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  // NFT list
  nftList: {
    gap: 4,
    marginBottom: 4,
  },
  // NFT row
  nftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 8,
    marginLeft: 34, // indent under chain icon
  },
  nftThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#e0e0e0',
  },
  nftInfo: {
    flex: 1,
    gap: 4,
  },
  nftName: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  countBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  nftArrow: {
    fontSize: 20,
    marginLeft: 6,
  },
  // Chain divider
  chainDivider: {
    height: 1,
    marginVertical: 6,
  },
  // States
  loadingContainer: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  refreshingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  refreshingText: {
    marginLeft: 8,
    fontSize: 13,
  },
});
