import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { ethers } from 'ethers';
import { SatochipCard } from 'satochip-react-native';

import { useTheme } from '@/hooks/useTheme';
import { SettingsStackScreenProps } from '@/utils/TypesUtil';
import { importSeed, handleSatochipError } from '@/wallets/satochip/SatochipClientNew';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import { FieldWithLabel } from '@/components/FieldWithLabel.tsx';
import useSatochipModal from '@/hooks/useSatochipModal.ts';
import SuccessIllustration from '@/assets/images/illustration.svg';
import AlertIllustration from '@/assets/images/alert_illustration.svg';

import setupStyles from '@/screens/Accounts/setupStyles.ts';

type Props = SettingsStackScreenProps<'SatochipImportSeed'>;

const INPUTS = {
  NONE: 'NONE',
  PIN: 'PIN',
  MNEMONIC: 'MNEMONIC',
  PASSPHRASE: 'PASSPHRASE',
};

export default function SatochipImportSeed({ navigation }: Props) {
  const Theme = useTheme();

  const [mnemonic, setMnemonic] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [pin, setPin] = useState('');
  const [activeInput, setActiveInput] = useState(INPUTS.NONE);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [ctaDisabled, setCtaDisabled] = useState(true);
  const [inputError, setInputError] = useState('');

  const [success, setSuccess] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const card = useRef(new SatochipCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  const handleCancel = () => {
    navigation.goBack();
  };

  const activateSeedImportAction = React.useCallback(async () => {
    try {

      let seedBytes: Buffer;
      const masterSeed = ethers.utils.mnemonicToSeed(mnemonic, passphrase);
      // Check what type we actually get at runtime, since ethers v5 has mismatch between the TypeScript type definitions and the actual runtime behavior.
      if (typeof masterSeed === 'string') {
        // Ethers v6 or future versions - hex string
        console.log('SatochipImportSeed - got seed as hex string');
        seedBytes = Buffer.from(masterSeed.slice(2), 'hex'); // Remove '0x'
      } else if (masterSeed instanceof Uint8Array) {
        // Ethers v5 - Uint8Array
        console.log('SatochipImportSeed - got seed as Uint8Array');
        seedBytes = Buffer.from(masterSeed);
      } else {
        console.log('SatochipImportSeed - got seed as unexpected type:', typeof masterSeed);
        throw new Error(`Unexpected seed type: ${typeof masterSeed}`)
      }

      await withModal(async () => importSeed(card, pin, seedBytes))();
      setSuccess(true);
    } catch (error) {
      setSuccess(false);
      const errorMessage = handleSatochipError(error, navigation);
      if (errorMessage) {
        setErrorMsg(errorMessage);
      }
    } finally {
      setShowResultModal(true);
      closeNfc();
      card.endNfcSession();
    }
  }, [pin, mnemonic, passphrase, navigation, card, closeNfc, withModal]);

  useEffect(() => {
    const isPinValid = pin?.length >= 4 && pin?.length <= 16;
    setCtaDisabled(!isPinValid);

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

    if (!isConfirmed){
      setCtaDisabled(true);
    }

  }, [pin, mnemonic, isConfirmed]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={styles.contentContainer}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Theme['fg-100'] }]}>
            Import Satochip Seed
          </Text>
          <Text style={[styles.subtitle, { color: Theme['fg-150'] }]}>
            This will import a BIP39 seed into a Satochip device
          </Text>
        </View>

        {/* PIN input field */}
        <View style={styles.inputContainer}>
          <FieldWithLabel
            label="Enter Satochip PIN"
            placeholder="Enter PIN"
            value={pin}
            onPress={() => setActiveInput(INPUTS.PIN)}
            onChangeText={setPin}
            isActive={activeInput===INPUTS.PIN}
          />
        </View>

        {/* Mnemonic input field */}
        <View style={styles.inputContainer}>
          {/* Label and generate button in a row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.inputLabel, { color: Theme['fg-100'] }]}>
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
              styles.input,
              {
                backgroundColor: Theme['bg-100'],
                color: Theme['fg-100'],
                borderColor: (activeInput === INPUTS.MNEMONIC) ? Theme['accent-100'] : Theme['bg-250'],
              },
            ]}
            placeholder="Enter your 12-24 word mnemonic phrase"
            placeholderTextColor={Theme['fg-300']}
            value={mnemonic}
            onChangeText={setMnemonic}
            onFocus={() => setActiveInput(INPUTS.MNEMONIC)}

            multiline={true}
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
          />
        </View>

        {/* Passphrase input field */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: Theme['fg-100'] }]}>
            Passphrase
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: Theme['bg-100'],
                color: Theme['fg-100'],
                borderColor: (activeInput === INPUTS.PASSPHRASE) ? Theme['accent-100'] : Theme['bg-250'],
              },
            ]}
            value={passphrase}
            onFocus={() => setActiveInput(INPUTS.PASSPHRASE)}
            onChangeText={setPassphrase}
            placeholder={"Enter passphrase (optional)"}
            placeholderTextColor={Theme['fg-300']}
            // secureTextEntry
            maxLength={64}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
          />
        </View>

        {/* Warning Checkbox */}
        <View style={[styles.warningCard, { backgroundColor: Theme['bg-100'] }]}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setIsConfirmed(!isConfirmed)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: Theme['accent-100'],
                  backgroundColor: isConfirmed ? Theme['accent-100'] : 'transparent',
                },
              ]}
            >
              {isConfirmed && (
                <Text style={[styles.checkmark, { color: Theme['inverse-100'] }]}>
                  ✓
                </Text>
              )}
            </View>
            <Text style={styles.warningText}>
              I have made a secure backup of my seed.
            </Text>
          </TouchableOpacity>
        </View>

        {/* input error message*/}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: Theme['error-100'] }]}>
            {inputError}
          </Text>
        </View>

        {/* Button Container */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: Theme['bg-250'],
              },
            ]}
            onPress={handleCancel}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                {
                  color: Theme['fg-300'],
                },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: ctaDisabled
                  ? Theme['bg-250']
                  : Theme['accent-100'],
              },
            ]}
            onPress={activateSeedImportAction}
            disabled={ctaDisabled}
          >
            <Text
              style={[
                styles.primaryButtonText,
                {
                  color: ctaDisabled ? Theme['fg-300'] : Theme['inverse-100'],
                },
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>

      </View>

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
              {success ? 'Seed imported' : 'Failed to import seed'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: Theme['fg-150'] }]}>
              {success
                ? 'Your seed has been imported successfully!'
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

      <NfcPrompt visible={nfcVisible} close={closeNfc} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  formCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  warningCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626', // Red color for warning
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryButtonText: {
    // flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  secondaryButtonText: {
    // flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // modal result window
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