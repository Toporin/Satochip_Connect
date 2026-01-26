import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ethers } from 'ethers';

import { useTheme } from '@/hooks/useTheme';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import {
  SensitiveInfo,
  SoftwareWalletInfo,
  WalletType,
} from '@/types/WalletTypes';
import setupStyles from './setupStyles';
import SettingsStore from '@/store/SettingsStore.ts';
import { WalletEncryptionService } from '../../wallets/WalletEncryptionService.ts';
import SuccessIllustration from '@/assets/images/illustration.svg';
import AlertIllustration from '@/assets/images/alert_illustration.svg';
import { CommonActions } from '@react-navigation/native';

type Props = AccountsStackScreenProps<'SetupSoftwareAccount'>;

export default function SetupSoftwareAccountScreen({ navigation }: Props) {
  const Theme = useTheme();

  const [mnemonic, setMnemonic] = useState('');
  const [passphrase, setPassphrase] = useState(''); // todo
  const [accountIndex, setAccountIndex] = useState(0);
  const [cardLabel, setCardLabel] = useState('');
  const [userPassword, setUserPassword] = useState('');

  const [isSettingUp, setIsSettingUp] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const [ctaDisabled, setCtaDisabled] = useState(true);
  const [inputError, setInputError] = useState('');
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  const derivationPath = `m/44'/60'/0'/0/${accountIndex}`;

  // derive address from mnemonic, passphrase & derivation path
  useEffect(() => {
    try {

      // Create HD Node from mnemonic
      const hdNode = ethers.utils.HDNode.fromMnemonic(
        mnemonic,
        passphrase // Optional BIP39 passphrase
      );

      // Derive path (e.g., "0/0" for first address)
      const derived = hdNode.derivePath(derivationPath);

      // Get the address
      const address = derived.address;

      // todo: check that address not already used!
      setCurrentAddress(address);
    } catch (error) {
      //console.error('SetupSoftwareAccountScreen - error deriving preview address:', error);
      setCurrentAddress('');
    }

  }, [mnemonic, derivationPath, passphrase]);

  // validate inputs
  useEffect(() => {
    const isPasswordValid = userPassword?.length >= 8 && userPassword?.length <= 64;
    setCtaDisabled(!isPasswordValid);

    if (!cardLabel.trim()) {
      setCtaDisabled(true);
    }

    if (!mnemonic.trim()) {
      setCtaDisabled(true);
    }

    if (!ethers.utils.isValidMnemonic(mnemonic)) {
      setCtaDisabled(true);
      if (mnemonic !== '') {
        setInputError("Wrong mnemonic, please enter a valid BIP39 mnemonic!");
      }
    } else {
      setInputError("");
    }

  }, [cardLabel, mnemonic, userPassword]);

  const handleCreateAccount = async () => {
    setIsSettingUp(true);

    try {
      // Create the actual wallet with real card connection
      const blockchain = "eip155";
      const id = `software-${blockchain}-${derivationPath}`

      // Create HD Node from mnemonic
      const hdNode = ethers.utils.HDNode.fromMnemonic(
        mnemonic,
        passphrase // Optional BIP39 passphrase, todo: currently default to ""
      );

      // Derive path (e.g., "0/0" for first address)
      const derived = hdNode.derivePath(derivationPath);

      // Get the address
      const address = derived.address;
      console.log(`handleCreateAccount derived address: ${address}`);

      const sensitiveInfo: SensitiveInfo = {
        keyType: "mnemonic",
        mnemonic: mnemonic,
        passphrase: passphrase,
        derivationPath: derivationPath,
      }

      // encrypt data
      const encryptedBlob =
        await WalletEncryptionService.encryptAndStore(
          sensitiveInfo,
          userPassword,
        );

      const softwareWalletInfo: SoftwareWalletInfo = {
        type: WalletType.SOFTWARE,
        id: id,
        name: cardLabel.trim(),
        address: address,
        blockchain: blockchain,
        encryptedBlob: encryptedBlob,
      };

      // this create/add/persist the wallet for storage
      SettingsStore.createSoftwareWallet(softwareWalletInfo, sensitiveInfo);

      setSuccess(true);
    } catch (error) {
      console.error('Error creating software account:', error);
      setSuccess(false);
      setErrorMsg((error as Error).message);
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
          Setup Software Account
        </Text>
        <Text style={[setupStyles.subtitle, { color: Theme['fg-150'] }]}>
          Create a software account based on a BIP39 mnemonic
        </Text>
      </View>

      {/* Account label */}
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

        {/* Account password TODO: add hint for user */}
        <View style={setupStyles.formGroup}>
          <Text style={[setupStyles.formLabel, { color: Theme['fg-100'] }]}>
            Account password
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
            placeholder="Used to encrypt the mnemonic (min 8 chars)"
            placeholderTextColor={Theme['fg-300']}
            value={userPassword}
            onChangeText={setUserPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
          />
        </View>


        <View style={setupStyles.formGroup}>

          {/* Label and generate button in a row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[setupStyles.formLabel, { color: Theme['fg-100'] }]}>
              BIP39 mnemonic
            </Text>
            <TouchableOpacity
              style={[
                setupStyles.accountIndexButton,
                {
                  backgroundColor: Theme['bg-175'],
                  width: 80, // Make button wider for "Generate" text
                }
              ]}
              onPress={() => {
                const randomWallet = ethers.Wallet.createRandom();
                setMnemonic(randomWallet.mnemonic.phrase);
              }}>
              <Text style={[setupStyles.accountIndexButtonText, { color: Theme['fg-100'], fontSize: 14 }]}>
                Generate
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mnemonic input - full width below */}
          <TextInput
            style={[
              setupStyles.textInput,
              {
                backgroundColor: Theme['bg-175'],
                color: Theme['fg-100'],
                borderColor: Theme['bg-250'],
                minHeight: 100,
                textAlignVertical: 'top',
                paddingTop: 10,
              }
            ]}
            placeholder="Enter your 12/24 word mnemonic phrase here"
            placeholderTextColor={Theme['fg-300']}
            value={mnemonic}
            onChangeText={setMnemonic}
            multiline={true}
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
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

      {/* input error message*/}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: Theme['error-100'] }]}>
          {inputError}
        </Text>
      </View>

      {/* Create account button */}
      <TouchableOpacity
        style={[
          setupStyles.createButton,
          {
            backgroundColor: ctaDisabled //isSettingUp || !cardLabel.trim()
              ? Theme['bg-250']
              : Theme['accent-100']
          }
        ]}
        onPress={handleCreateAccount}
        // disabled={isSettingUp || !cardLabel.trim()}>
        disabled={ctaDisabled}>
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