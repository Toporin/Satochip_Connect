import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '@/hooks/useTheme';
import {IWalletProvider, WalletType} from '@/types/WalletTypes';

interface Props {
  wallets: IWalletProvider[];
  selectedId?: string;
  onSelect: (walletId: string) => void;
}

const TYPE_LABELS: Record<WalletType, string> = {
  [WalletType.SOFTWARE]: 'Software (password)',
  [WalletType.SATOCHIP]: 'Satochip card (PIN)',
  [WalletType.SATODIME]: 'Satodime card',
};

/**
 * Shown when several accounts share the request address: the user picks the
 * account that signs (and therefore whether a PIN or a password is asked).
 */
export function AccountSelector({wallets, selectedId, onSelect}: Props) {
  const Theme = useTheme();

  return (
    <View style={[styles.container, {backgroundColor: Theme['bg-150']}]}>
      <Text style={[styles.title, {color: Theme['fg-150']}]}>
        Several accounts use this address. Choose the one to sign with:
      </Text>
      {wallets.map(wallet => {
        const isSelected = wallet.id === selectedId;
        const name = wallet.getWalletInfo().name || 'Account';
        return (
          <TouchableOpacity
            key={wallet.id}
            onPress={() => onSelect(wallet.id)}
            style={[
              styles.option,
              {
                backgroundColor: isSelected ? Theme['accent-glass-020'] : Theme['bg-250'],
                borderColor: isSelected ? Theme['accent-100'] : Theme['bg-300'],
              },
            ]}>
            <Text
              style={[styles.name, {color: isSelected ? Theme['accent-100'] : Theme['fg-100']}]}
              numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.type, {color: Theme['fg-150']}]}>
              {TYPE_LABELS[wallet.type] ?? wallet.type}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 8,
    rowGap: 6,
  },
  title: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    margin: 4,
  },
  option: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  type: {
    fontSize: 12,
    marginTop: 2,
  },
});
