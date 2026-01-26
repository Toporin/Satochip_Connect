import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { ethers } from 'ethers';

import { useTheme } from '@/hooks/useTheme';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import {
  WalletType,
  WalletError,
  WalletErrorType,
  SatochipInfo,
} from '@/types/WalletTypes';
import setupStyles from './setupStyles';
import SettingsStore from '@/store/SettingsStore.ts';
import SuccessIllustration from '@/assets/images/illustration.svg';
import AlertIllustration from '@/assets/images/alert_illustration.svg';
import { CommonActions } from '@react-navigation/native';

type Props = AccountsStackScreenProps<'SatochipSetup'>;

export default function SatochipSetupScreen({ navigation, route }: Props) {
  const Theme = useTheme();
  const { masterXfp, xpub, isAuthentic, authenticityMsg } = route.params;
  
  // const [pin, setPin] = useState('');
  const [accountIndex, setAccountIndex] = useState(0);
  const [cardLabel, setCardLabel] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  const derivationPath = `m/44'/60'/0'/0/${accountIndex}`;
  const isNewCard = !masterXfp; // todo: needed? masterXfp should always have a value

  useEffect(() => {
    if (masterXfp) {
      // Check if we already have accounts for this card
      const existingWallets = SettingsStore.getSatochipWallets();
      const cardWallets = existingWallets.filter(w => {
        const info = w.getWalletInfo();
        return info.masterXfp === masterXfp;
      });
      
      // Set the next available account index
      setAccountIndex(cardWallets.length);
    }
  }, [masterXfp]);

  // derive address from mnemonic, passphrase & derivation path
  useEffect(() => {
    try {

      // Create HD node from xpub
      const hdNode = ethers.utils.HDNode.fromExtendedKey(xpub);

      // Derive path (e.g., "0/0" for first address)
      const derived = hdNode.derivePath(derivationPath);

      // Get the address
      const address = derived.address;

      // todo: check that address not already used!
      setCurrentAddress(address);
    } catch (error) {
      console.error('SetupSoftwareAccountScreen - error deriving preview address:', error);
      setCurrentAddress('');
    }
  }, [xpub, derivationPath]);

  const validateInputs = () => {
    //todo: check that address not already used!

    if (!cardLabel.trim()) {
      Alert.alert('Label Required', 'Please enter a label for this account');
      return false;
    }

    return true;
  };

  const handleCreateAccount = async () => {
    if (!validateInputs()) return;

    setIsSettingUp(true);

    try {
      // Create the actual wallet with real card connection
      const blockchain = "eip155";
      const id = `satochip-${blockchain}-${masterXfp}-${derivationPath}`

      // Create HD node from xpub
      const hdNode = ethers.utils.HDNode.fromExtendedKey(xpub);

      // Derive path (e.g., "0/0" for first address)
      const derived = hdNode.derivePath(`0/${accountIndex}`);

      // Get the address
      const address = derived.address;
      console.log(`handleCreateAccount derived address: ${address}`);

      const satochipInfo: SatochipInfo = {
        id: id,
        name: cardLabel.trim(),
        type: WalletType.SATOCHIP,
        address: address,
        blockchain: blockchain,
        masterXfp: masterXfp,
        xpub: xpub,
        derivationPath: derivationPath,
      };

      // this creates/adds/persists the wallet for storage
      SettingsStore.createSatochipWallet(satochipInfo);

      setSuccess(true);
    } catch (error) {
      console.error('Error creating Satochip account:', error);
      setSuccess(false);
      if (error instanceof WalletError) {
        if (error.type === WalletErrorType.INVALID_PIN) {
          setErrorMsg('The PIN you entered is incorrect');
          // Alert.alert('Invalid PIN', 'The PIN you entered is incorrect');
        } else if (error.type === WalletErrorType.PIN_BLOCKED) {
          setErrorMsg('Your card PIN is blocked. Please use PUK to unblock.');
          // Alert.alert('PIN Blocked', 'Your card PIN is blocked. Please use PUK to unblock.');
        } else if (error.type === WalletErrorType.CONNECTION_FAILED) {
          setErrorMsg('Failed to connect to the card. Please ensure the card is properly positioned and try again.');
          // Alert.alert('Connection Error', 'Failed to connect to the card. Please ensure the card is properly positioned and try again.');
        } else {
          setErrorMsg(error.message);
          // Alert.alert('Setup Error', error.message);
        }
      } else {
        setErrorMsg(`Failed to create Satochip account. ${(error as Error).message}`);
        // Alert.alert('Error', 'Failed to create Satochip account. Please try again.');
      }
    } finally {
      setIsSettingUp(false);
      setShowResultModal(true);
    }
  };

  return (
    <ScrollView
      style={[setupStyles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={setupStyles.content}
      contentInsetAdjustmentBehavior="automatic">
      
      <View style={setupStyles.header}>
        <Text style={[setupStyles.title, { color: Theme['fg-100'] }]}>
          Setup Satochip Account
        </Text>
        <Text style={[setupStyles.subtitle, { color: Theme['fg-150'] }]}>
          {isNewCard 
            ? 'Configure your new Satochip card' 
            : `Add account to card ${masterXfp}`
          }
        </Text>
      </View>

      {masterXfp && (
        <View style={[setupStyles.cardInfo, { backgroundColor: Theme['bg-175'] }]}>
          <Text style={[setupStyles.cardInfoTitle, { color: Theme['fg-100'] }]}>
            Card Information
          </Text>
          <View style={setupStyles.cardInfoRow}>
            <Text style={[setupStyles.cardInfoLabel, { color: Theme['fg-150'] }]}>
              Master Fingerprint:
            </Text>
            <Text style={[setupStyles.cardInfoValue, { color: Theme['accent-100'] }]}>
              {masterXfp}
            </Text>
          </View>
        </View>
      )}

      <View style={setupStyles.form}>
        <View style={setupStyles.formGroup}>
          <Text style={[setupStyles.formLabel, { color: Theme['fg-100'] }]}>
            Account Label
          </Text>
          <TextInput
            style={[
              setupStyles.textInput,
              { 
                backgroundColor: Theme['bg-175'], 
                color: Theme['fg-100'],
                borderColor: Theme['bg-250']
              }
            ]}
            placeholder="e.g. My Ethereum Account"
            placeholderTextColor={Theme['fg-300']}
            value={cardLabel}
            onChangeText={setCardLabel}
            maxLength={50}
          />
        </View>

        {/* Account index */}
        <View style={setupStyles.formGroup}>
          <Text style={[setupStyles.formLabel, { color: Theme['fg-100'] }]}>
            Account Index
          </Text>
          <View style={setupStyles.accountIndexContainer}>
            <TouchableOpacity
              style={[
                setupStyles.accountIndexButton,
                { backgroundColor: Theme['bg-175'] },
                accountIndex === 0 && { backgroundColor: Theme['bg-250'] }
              ]}
              onPress={() => setAccountIndex(Math.max(0, accountIndex - 1))}
              disabled={accountIndex === 0}>
              <Text style={[
                setupStyles.accountIndexButtonText,
                { color: accountIndex === 0 ? Theme['fg-300'] : Theme['fg-100'] }
              ]}>
                -
              </Text>
            </TouchableOpacity>
            <View style={[setupStyles.accountIndexDisplay, { backgroundColor: Theme['bg-175'] }]}>
              <Text style={[setupStyles.accountIndexText, { color: Theme['fg-100'] }]}>
                {accountIndex}
              </Text>
            </View>
            <TouchableOpacity
              style={[setupStyles.accountIndexButton, { backgroundColor: Theme['bg-175'] }]}
              onPress={() => setAccountIndex(accountIndex + 1)}>
              <Text style={[setupStyles.accountIndexButtonText, { color: Theme['fg-100'] }]}>
                +
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[setupStyles.formHelp, { color: Theme['fg-150'] }]}>
            Derivation path: {derivationPath}
          </Text>
        </View>

        {/* Address preview */}
        {currentAddress && (
          <View style={[setupStyles.previewCard, { backgroundColor: Theme['bg-175'] }]}>
            <Text style={[setupStyles.previewTitle, { color: Theme['fg-100'] }]}>
              Address Preview
            </Text>
            <Text style={[setupStyles.previewAddress, { color: Theme['accent-100'] }]}>
              {currentAddress}
            </Text>
          </View>
        )}
      </View>

      {/* Create account button */}
      <TouchableOpacity
        style={[
          setupStyles.createButton,
          { 
            backgroundColor: isSettingUp || !cardLabel.trim()
              ? Theme['bg-250'] 
              : Theme['accent-100'] 
          }
        ]}
        onPress={handleCreateAccount}
        disabled={isSettingUp || !cardLabel.trim()}>
        {isSettingUp ? (
          <View style={setupStyles.createButtonLoading}>
            <ActivityIndicator size="small" color={Theme['inverse-100']} />
            <Text style={[setupStyles.createButtonText, { color: Theme['inverse-100'] }]}>
              Creating Account...
            </Text>
          </View>
        ) : (
          <Text style={[
            setupStyles.createButtonText,
            { 
              color: ( !cardLabel.trim() )
                ? Theme['fg-300'] 
                : Theme['inverse-100'] 
            }
          ]}>
            Create Account
          </Text>
        )}
      </TouchableOpacity>

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Theme['bg-100'] }]}>
            <Text style={[styles.modalTitle, { color: Theme['fg-100'] }]}>
              {success ? 'Account created' : 'Failed to create account'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: Theme['fg-150'] }]}>
              {success
                ? 'Your software account has been created successfully!'
                : errorMsg}
            </Text>

            <View style={styles.modalIllustration}>
              {success ? <SuccessIllustration /> : <AlertIllustration />}
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: Theme['accent-100'] }]}
              onPress={() => {
                setShowResultModal(false);
                navigation.dispatch(CommonActions.goBack());
              }}
            >
              <Text style={[styles.modalButtonText, { color: Theme['inverse-100'] }]}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  modalIllustration: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});