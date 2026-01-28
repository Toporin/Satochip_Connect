import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { useSnapshot } from 'valtio';
import ShoppingCartIcon from '@/assets/images/shopping_cart.svg';

import { useTheme } from '@/hooks/useTheme';
import SettingsStore from '@/store/SettingsStore';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import styles from './styles';
import { Icon } from '@reown/appkit-ui-react-native';
import { formatUSD } from '@/utils/formatters';

type Props = AccountsStackScreenProps<'Accounts'>;

interface AccountItem {
  id: string;
  name: string;
  address: string;
  type: 'software' | 'hardware';
  blockchain: string;
  masterXfp?: string; // For Satochip accounts
  derivationPath?: string;
}

export default function AccountsScreen({ navigation }: Props) {
  const Theme = useTheme();

  // Subscribe to SettingsStore state changes
  const { wallets, balances } = useSnapshot(SettingsStore.state);
  
  // Compute accounts directly from the reactive wallets state
  const accounts = React.useMemo((): AccountItem[] => {
    const accountsList: AccountItem[] = [];

    // Add Satochip hardware wallets
    const satochipWallets = SettingsStore.getSatochipWallets();
    for (const wallet of satochipWallets) {
      const info = wallet.getWalletInfo();
      accountsList.push({
        id: wallet.id,
        name: `${info.name || 'Satochip'}`,
        address: wallet.address || 'Not derived',
        type: 'hardware',
        blockchain: wallet.blockchain,
        masterXfp: info.masterXfp,
        derivationPath: info.derivationPath,
      });
    }

    // Add software wallets
    const softwareWallets = SettingsStore.getSoftwareWallets();
    for (const wallet of softwareWallets) {
      const info = wallet.getWalletInfo();
      accountsList.push({
        id: wallet.id,
        name: `${info.name || 'Software'}`,
        address: wallet.address,
        type: 'software',
        blockchain: wallet.blockchain,
      });
    }

    return accountsList;
  }, [wallets]); // Re-compute when wallets Map changes

  // Calculate total USD balance for each account
  const accountBalances = React.useMemo(() => {
    const result: Record<string, number> = {};

    accounts.forEach(account => {
      let total = 0;
      for (const [key, entry] of Object.entries(balances)) {
        // Filter balances for this specific address
        if (key.startsWith(`${account.address}:`)) {
          if (entry.balance !== '0' &&
              !entry.error &&
              entry.usdValue !== undefined) {
            total += entry.usdValue;
          }
        }
      }
      result[account.address] = total;
    });

    return result;
  }, [accounts, balances]);

  const copyToClipboard = (value: string, label: string) => {
    Clipboard.setString(value);
    Toast.show({
      type: 'success',
      text1: `${label} copied to clipboard`,
    });

  };

  const handleAddAccount = () => {
    navigation.navigate('AddSatochipAccount');
  };

  const handleAddSoftwareAccount = () => {
    navigation.navigate('SetupSoftwareAccount');
  };

  const handleBuySatochip = () => {
    Linking.openURL('https://satochip.io/product/satochip/');
  };

  const renderAccountCard = (account: AccountItem) => {
    const isHardware = account.type === 'hardware';

    return (
      <View
        key={account.id}
        style={[styles.accountCard, { backgroundColor: Theme['bg-175'] }]}>
        <View style={styles.accountHeader}>
          <Text style={[styles.accountName, { color: Theme['fg-100'] }]}>
            {account.name}
          </Text>
          <View style={[
            styles.accountTypeChip,
            { backgroundColor: isHardware ? Theme['accent-100'] : Theme['bg-250'] }
          ]}>
            <Text style={[
              styles.accountTypeText,
              { color: isHardware ? Theme['inverse-100'] : Theme['fg-150'] }
            ]}>
              {isHardware ? 'Hardware' : 'Software'}
            </Text>
          </View>
        </View>

        {/*<View style={styles.accountDetails}>*/}
        {/*  <Text style={[styles.accountLabel, { color: Theme['fg-150'] }]}>*/}
        {/*    Blockchain*/}
        {/*  </Text>*/}
        {/*  <Text style={[styles.accountValue, { color: Theme['fg-100'] }]}>*/}
        {/*    {account.blockchain.charAt(0).toUpperCase() + account.blockchain.slice(1)}*/}
        {/*  </Text>*/}
        {/*</View>*/}

        {/* Balance display (only show if > 0) */}
        {accountBalances[account.address] > 0 && (
          <View style={styles.accountDetails}>
            <Text style={[styles.accountLabel, { color: Theme['fg-150'] }]}>
              Balance
            </Text>
            <Text style={[styles.accountValue, { color: Theme['accent-100'] }]}>
              {formatUSD(accountBalances[account.address])}
            </Text>
          </View>
        )}

        <View style={styles.accountDetails}>
          <Text style={[styles.accountLabel, { color: Theme['fg-150'] }]}>
            Address
          </Text>
          <TouchableOpacity onPress={() => copyToClipboard(account.address, 'Address')}>
            <Text style={[styles.accountValue, styles.copyableText, { color: Theme['accent-100'] }]}>
              {account.address.length > 20
                ? `${account.address.slice(0, 10)}...${account.address.slice(-10)}`
                : account.address
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Send icon button - positioned in top-right */}
        <TouchableOpacity
          style={[styles.sendIconButton, { backgroundColor: Theme['accent-glass-020'] }]}
          onPress={() => navigation.navigate('SendTransaction', {
            accountId: account.id
          })}
          activeOpacity={0.7}>
          <Text style={[styles.sendIconText, { color: Theme['accent-100'] }]}>
            Send
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chevronButton}
          onPress={() => navigation.navigate('AccountDetails', { accountId: account.id })}
          activeOpacity={0.7}>
          <Icon name={"chevronRight"} size="sm" color={'fg-100'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: Theme['fg-100'] }]}>
          Your Accounts
        </Text>
        <Text style={[styles.subtitle, { color: Theme['fg-150'] }]}>
          Manage your software and hardware wallet accounts
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: Theme['fg-100'] }]}>
            Accounts ({accounts.length})
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: Theme['accent-100'] }]}
            onPress={handleAddAccount}>
            <Text style={[styles.addButtonText, { color: Theme['inverse-100'] }]}>
              Add Satochip
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: Theme['accent-100'] }]}
            onPress={handleAddSoftwareAccount}>
            <Text style={[styles.addButtonText, { color: Theme['inverse-100'] }]}>
              Add Soft Wallet
            </Text>
          </TouchableOpacity>
        </View>

        {accounts.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: Theme['bg-175'] }]}>
            <Text style={[styles.emptyTitle, { color: Theme['fg-100'] }]}>
              No accounts found
            </Text>
            <Text style={[styles.emptyDescription, { color: Theme['fg-150'] }]}>
              Add your first Satochip hardware wallet account to get started
            </Text>
          </View>
        ) : (
          <View style={styles.accountsList}>
            {accounts.map(renderAccountCard)}
          </View>
        )}
      </View>

      {/* Buy Satochip Button */}
      <TouchableOpacity
        style={[styles.buySatochipButton, { backgroundColor: Theme['bg-175'] }]}
        onPress={handleBuySatochip}
        activeOpacity={0.7}>
        <ShoppingCartIcon width={24} height={24} fill={Theme['accent-100']} />
        <Text style={[styles.buySatochipText, { color: Theme['fg-100'] }]}>
          You don't have a Satochip yet?{'\n'}Click here to buy one.
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}