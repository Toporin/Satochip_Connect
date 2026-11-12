import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSnapshot } from 'valtio';

import { useTheme } from '@/hooks/useTheme';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import SettingsStore from '@/store/SettingsStore';
import { SatodimeInfo, SatodimeVaultState, WalletType } from '@/types/WalletTypes';
import { SATODIME_VAULT_STATE_LABELS } from '@/constants/Satodime';
import { ScannedVault } from '@/wallets/satodime/SatodimeClient';
import { SatodimeWallet } from '@/wallets/satodime/SatodimeWallet';
import setupStyles from './setupStyles';

type Props = AccountsStackScreenProps<'SatodimeVaultSelect'>;

type VaultAvailability = { selectable: true } | { selectable: false; reason: string };

export default function SatodimeVaultSelectScreen({ route, navigation }: Props) {
  const Theme = useTheme();
  const { scan } = route.params;
  const { wallets } = useSnapshot(SettingsStore.state);

  const [selected, setSelected] = useState<number | null>(null);
  const [label, setLabel] = useState('');

  const existingIds = useMemo(() => new Set(Array.from(wallets.keys())), [wallets]);

  const availability = (vault: ScannedVault): VaultAvailability => {
    if (vault.state === SatodimeVaultState.UNINITIALIZED) {
      return { selectable: false, reason: 'Empty vault' };
    }
    if (!vault.network.supported || !vault.address || !vault.pubkey) {
      return { selectable: false, reason: 'Unsupported' };
    }
    if (existingIds.has(SatodimeWallet.makeId(scan.authentikey, vault.index))) {
      return { selectable: false, reason: 'Already added' };
    }
    return { selectable: true };
  };

  const selectedVault = scan.vaults.find(v => v.index === selected);
  const canCreate =
    selectedVault !== undefined && availability(selectedVault).selectable && label.trim().length > 0;

  const handleCreate = () => {
    if (!selectedVault || !canCreate || !selectedVault.address || !selectedVault.pubkey) {
      return;
    }
    const info: SatodimeInfo = {
      id: SatodimeWallet.makeId(scan.authentikey, selectedVault.index),
      name: label.trim(),
      type: WalletType.SATODIME,
      address: selectedVault.address,
      blockchain: 'eip155',
      authentikey: scan.authentikey,
      vaultIndex: selectedVault.index,
      pubkey: selectedVault.pubkey,
      slip44: selectedVault.slip44,
      vaultState: selectedVault.state,
      cardLabel: scan.label || undefined,
    };
    const wallet = SettingsStore.createSatodimeWallet(info);
    if (!wallet) {
      Toast.show({ type: 'error', text1: 'Failed to create the account' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Satodime account created', text2: info.name });
    navigation.navigate('Accounts');
  };

  // Card too old: on-card signing needs protocol v0.2-0.1
  if (!scan.supportsHashSigning) {
    return (
      <View style={[styles.center, { backgroundColor: Theme['bg-100'] }]}>
        <Text style={[setupStyles.title, { color: Theme['fg-100'] }]}>Card version not supported</Text>
        <Text style={[styles.centerText, { color: Theme['fg-150'] }]}>
          This Satodime runs {scan.versionLabel}. Satochip Connect needs Satodime v0.2-0.1 or later, which can
          sign transactions on the card.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[setupStyles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={setupStyles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={setupStyles.header}>
        <Text style={[setupStyles.title, { color: Theme['fg-100'] }]}>Select a vault</Text>
        <Text style={[setupStyles.subtitle, { color: Theme['fg-150'] }]}>
          {scan.label ? `${scan.label} · ` : ''}Satodime {scan.versionLabel}
        </Text>
      </View>

      <View style={[setupStyles.cardInfo, { backgroundColor: Theme['bg-175'] }]}>
        <Text style={[styles.small, { color: scan.isAuthentic ? Theme['fg-150'] : Theme['error-100'] }]}>
          {scan.isAuthentic ? '✓ Authentic Satodime' : `⚠ Authenticity not verified: ${scan.authenticityMsg}`}
        </Text>
      </View>

      <View style={styles.list}>
        {scan.vaults.map(vault => {
          const avail = availability(vault);
          const isSelected = selected === vault.index;
          return (
            <TouchableOpacity
              key={vault.index}
              disabled={!avail.selectable}
              onPress={() => setSelected(vault.index)}
              style={[
                styles.vault,
                !avail.selectable && styles.vaultDisabled,
                {
                  backgroundColor: Theme['bg-175'],
                  borderColor: isSelected ? Theme['accent-100'] : Theme['bg-250'],
                },
              ]}>
              <View style={styles.vaultHeader}>
                <Text style={[styles.vaultTitle, { color: Theme['fg-100'] }]}>Vault #{vault.index + 1}</Text>
                <Text style={[styles.badge, { color: Theme['fg-150'], borderColor: Theme['bg-300'] }]}>
                  {SATODIME_VAULT_STATE_LABELS[vault.state] ?? `State ${vault.state}`}
                </Text>
              </View>
              {vault.state !== SatodimeVaultState.UNINITIALIZED && (
                <Text style={[styles.small, { color: Theme['fg-150'] }]}>{vault.network.label}</Text>
              )}
              {vault.address && (
                <Text style={[styles.address, { color: Theme['accent-100'] }]} selectable>
                  {vault.address}
                </Text>
              )}
              {!avail.selectable && (
                <Text style={[styles.small, { color: Theme['fg-150'] }]}>{avail.reason}</Text>
              )}
              {avail.selectable && vault.state === SatodimeVaultState.UNSEALED && (
                <Text style={[styles.warning, { color: Theme['error-100'] }]}>
                  ⚠ Unsealed: anyone holding this card can spend from this vault.
                </Text>
              )}
              {avail.selectable && vault.state === SatodimeVaultState.SEALED && (
                <Text style={[styles.small, { color: Theme['fg-150'] }]}>
                  Sealed: added as watch-only. Unseal it in the Satodime app to spend.
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={setupStyles.form}>
        <View style={setupStyles.formGroup}>
          <Text style={[setupStyles.formLabel, { color: Theme['fg-100'] }]}>Account Label</Text>
          <TextInput
            style={[
              setupStyles.textInput,
              { backgroundColor: Theme['bg-175'], color: Theme['fg-100'], borderColor: Theme['bg-250'] },
            ]}
            placeholder="e.g. My Satodime vault"
            placeholderTextColor={Theme['fg-300']}
            value={label}
            onChangeText={setLabel}
            maxLength={50}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[setupStyles.createButton, { backgroundColor: canCreate ? Theme['accent-100'] : Theme['bg-250'] }]}
        onPress={handleCreate}
        disabled={!canCreate}>
        <Text style={[setupStyles.createButtonText, { color: canCreate ? Theme['inverse-100'] : Theme['fg-300'] }]}>
          Create Account
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: 12,
  },
  centerText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    rowGap: 12,
    marginBottom: 24,
  },
  vault: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    rowGap: 6,
  },
  vaultDisabled: {
    opacity: 0.5,
  },
  vaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vaultTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  address: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  small: {
    fontSize: 12,
  },
  warning: {
    fontSize: 12,
    fontWeight: '600',
  },
});
