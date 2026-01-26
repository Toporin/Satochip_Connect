import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useSnapshot } from 'valtio';

import { useTheme } from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import { formatBalance, formatUSD } from '@/utils/formatters';
import { EIP155_NETWORK_IMAGES } from '@/constants/Eip155';
import type { BalanceEntry } from '@/services/BalanceService';

interface BalanceTableProps {
  addressBalances: BalanceEntry[];
}

export default function BalanceTable({ addressBalances }: BalanceTableProps) {
  const Theme = useTheme();
  const { balancesLoading, balancesError } = useSnapshot(SettingsStore.state);

  // Calculate total portfolio value
  const totalValue = React.useMemo(() => {
    return addressBalances.reduce((sum, entry) => {
      return sum + (entry.usdValue || 0);
    }, 0);
  }, [addressBalances]);

  // Render loading state
  if (balancesLoading && addressBalances.length === 0) {
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
  if (balancesError && addressBalances.length === 0) {
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
  if (addressBalances.length === 0) {
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
        {addressBalances.map((entry, index) => {
          const chainKey = `eip155:${entry.chainId}`;
          const chainImage = EIP155_NETWORK_IMAGES[chainKey];
          const isLast = index === addressBalances.length - 1;

          return (
            <View key={entry.chainId}>
              <View style={styles.balanceRow}>
                {/* Chain icon and name */}
                <View style={styles.chainInfo}>
                  {chainImage && (
                    <Image source={chainImage} style={styles.chainIcon} />
                  )}
                  <Text style={[styles.chainName, { color: Theme['fg-100'] }]}>
                    {entry.chainName}
                  </Text>
                </View>

                {/* Balance and USD value */}
                <View style={styles.balanceInfo}>
                  <Text style={[styles.balanceAmount, { color: Theme['fg-100'] }]}>
                    {formatBalance(entry.balance, entry.decimals)} {entry.symbol}
                  </Text>
                  {entry.usdValue !== undefined && (
                    <Text style={[styles.balanceUSD, { color: Theme['fg-150'] }]}>
                      {formatUSD(entry.usdValue)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Divider (not shown for last item) */}
              {!isLast && (
                <View style={[styles.rowDivider, { backgroundColor: Theme['bg-250'] }]} />
              )}
            </View>
          );
        })}
      </View>

      {/* Loading indicator for refresh */}
      {balancesLoading && (
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
