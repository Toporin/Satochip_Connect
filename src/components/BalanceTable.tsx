import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useSnapshot } from 'valtio';

import { useTheme } from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import { formatBalance, formatUSD } from '@/utils/formatters';
import { EIP155_NETWORK_IMAGES } from '@/constants/Eip155';
import Unknown from '@/assets/chains/unknown.png';
import type { BalanceEntry } from '@/services/BalanceService';
import type { TokenBalanceEntry } from '@/services/TokenService';

interface BalanceTableProps {
  addressBalances: BalanceEntry[];
  addressTokenBalances: Map<number, TokenBalanceEntry[]>;
}

export default function BalanceTable({ addressBalances, addressTokenBalances }: BalanceTableProps) {
  const Theme = useTheme();
  const { balancesLoading, balancesError, tokenBalancesLoading } = useSnapshot(SettingsStore.state);

  // Build merged chain list: union of native balance chains + token chains
  const mergedChainIds = React.useMemo(() => {
    const nativeChainIds = addressBalances.map(e => e.chainId);
    const tokenChainIds = Array.from(addressTokenBalances.keys());
    const all = new Set([...nativeChainIds, ...tokenChainIds]);
    return Array.from(all);
  }, [addressBalances, addressTokenBalances]);

  // Build native entry lookup
  const nativeByChain = React.useMemo(() => {
    const map = new Map<number, BalanceEntry>();
    for (const entry of addressBalances) {
      map.set(entry.chainId, entry);
    }
    return map;
  }, [addressBalances]);

  // Calculate total portfolio value (native + tokens)
  const totalValue = React.useMemo(() => {
    const nativeTotal = addressBalances.reduce((sum, e) => sum + (e.usdValue || 0), 0);
    let tokenTotal = 0;
    for (const entries of addressTokenBalances.values()) {
      for (const entry of entries) {
        tokenTotal += entry.usdValue ?? 0;
      }
    }
    return nativeTotal + tokenTotal;
  }, [addressBalances, addressTokenBalances]);

  const isLoading = balancesLoading || tokenBalancesLoading;
  const hasContent = mergedChainIds.length > 0;

  // Render loading state
  if (isLoading && !hasContent) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>Balances</Text>
        <View style={[styles.loadingContainer, { backgroundColor: Theme['bg-175'] }]}>
          <ActivityIndicator size="large" color={Theme['accent-100']} />
          <Text style={[styles.loadingText, { color: Theme['fg-150'] }]}>
            Fetching balances...
          </Text>
        </View>
      </View>
    );
  }

  // Render error state
  if (balancesError && !hasContent) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>Balances</Text>
        <View style={[styles.errorContainer, { backgroundColor: Theme['bg-175'] }]}>
          <Text style={[styles.errorText, { color: Theme['error-100'] }]}>
            {balancesError}
          </Text>
        </View>
      </View>
    );
  }

  // Render empty state
  if (!hasContent) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>Balances</Text>
        <View style={[styles.emptyContainer, { backgroundColor: Theme['bg-175'] }]}>
          <Text style={[styles.emptyText, { color: Theme['fg-150'] }]}>
            No balances found
          </Text>
          <Text style={[styles.emptySubtext, { color: Theme['fg-200'] }]}>
            This address has no assets on supported chains
          </Text>
        </View>
      </View>
    );
  }

  // Render balance table
  return (
    <View style={styles.section}>
      <View style={styles.headerContainer}>
        <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>Balances</Text>
        {totalValue > 0 && (
          <View style={[styles.totalValueChip, { backgroundColor: Theme['accent-100'] }]}>
            <Text style={[styles.totalValueText, { color: Theme['inverse-100'] }]}>
              {formatUSD(totalValue)}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.balanceCard, { backgroundColor: Theme['bg-175'] }]}>
        {mergedChainIds.map((chainId, chainIdx) => {
          const chainKey = `eip155:${chainId}`;
          const chainImage = EIP155_NETWORK_IMAGES[chainKey];
          const nativeEntry = nativeByChain.get(chainId);
          const chainTokens = addressTokenBalances.get(chainId) || [];
          const isLastChain = chainIdx === mergedChainIds.length - 1;

          return (
            <View key={chainId}>
              {/* Native balance row */}
              <View style={styles.balanceRow}>
                <View style={styles.chainInfo}>
                  {chainImage ? (
                    <Image source={chainImage} style={styles.chainIcon} />
                  ) : (
                    <Image source={Unknown} style={styles.chainIcon} />
                  )}
                  <Text style={[styles.chainName, { color: Theme['fg-100'] }]}>
                    {nativeEntry?.chainName || `Chain ${chainId}`}
                  </Text>
                </View>

                <View style={styles.balanceInfo}>
                  {nativeEntry ? (
                    <>
                      <Text style={[styles.balanceAmount, { color: Theme['fg-100'] }]}>
                        {formatBalance(nativeEntry.balance, nativeEntry.decimals)} {nativeEntry.symbol}
                      </Text>
                      {nativeEntry.usdValue !== undefined && nativeEntry.usdValue > 0 && (
                        <Text style={[styles.balanceUSD, { color: Theme['fg-150'] }]}>
                          {formatUSD(nativeEntry.usdValue)}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={[styles.balanceAmount, { color: Theme['fg-200'] }]}>—</Text>
                  )}
                </View>
              </View>

              {/* Token rows for this chain */}
              {chainTokens.map(token => (
                <View key={token.contract} style={[styles.tokenRowContainer, { backgroundColor: Theme['bg-200'] }]}>
                  <View style={styles.chainInfo}>
                    {token.logoURI ? (
                      <Image source={{ uri: token.logoURI }} style={styles.tokenIcon} />
                    ) : (
                      <Image source={Unknown} style={styles.tokenIcon} />
                    )}
                    <Text style={[styles.tokenName, { color: Theme['fg-100'] }]}>
                      {token.name || token.symbol}
                    </Text>
                  </View>

                  <View style={styles.balanceInfo}>
                    <Text style={[styles.tokenAmount, { color: Theme['fg-100'] }]}>
                      {formatBalance(token.balance, token.decimals)} {token.symbol}
                    </Text>
                    {token.usdValue !== undefined && (
                      <Text style={[styles.balanceUSD, { color: Theme['fg-150'] }]}>
                        {formatUSD(token.usdValue)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              {/* Chain divider */}
              {!isLastChain && (
                <View style={[styles.rowDivider, { backgroundColor: Theme['bg-250'] }]} />
              )}
            </View>
          );
        })}
      </View>

      {/* Loading indicator for refresh */}
      {isLoading && (
        <View style={styles.refreshingContainer}>
          <ActivityIndicator size="small" color={Theme['accent-100']} />
          <Text style={[styles.refreshingText, { color: Theme['fg-150'] }]}>
            Updating...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  totalValueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {
    borderRadius: 12,
    padding: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
    marginRight: 12,
  },
  chainName: {
    fontSize: 15,
    fontWeight: '500',
  },
  balanceInfo: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceUSD: {
    fontSize: 13,
    fontWeight: '400',
  },
  tokenRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingLeft: 12,
    borderRadius: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  tokenIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  tokenName: {
    fontSize: 13,
    fontWeight: '400',
  },
  tokenAmount: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  rowDivider: {
    height: 1,
    marginVertical: 8,
  },
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
