import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { SettingsStackScreenProps } from '@/utils/TypesUtil';
import { SatochipCard } from 'satochip-react-native';
import { handleSatochipError } from '@/wallets/satochip/SatochipClientNew';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import useSatochipModal from '@/hooks/useSatochipModal.ts';
import { resetSeed } from '../../wallets/satochip/SatochipClientNew.ts';
import SuccessIllustration from '@/assets/images/illustration.svg';
import AlertIllustration from '@/assets/images/alert_illustration.svg';
import { CommonActions } from '@react-navigation/native';
import { FieldWithLabel } from '@/components/FieldWithLabel.tsx';

type Props = SettingsStackScreenProps<'SatochipResetSeed'>;

export default function SatochipResetSeed({ navigation }: Props) {
  const Theme = useTheme();

  const [pin, setPin] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [ctaDisabled, setCtaDisabled] = useState(true);

  const [success, setSuccess] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const card = useRef(new SatochipCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  const handleCancel = () => {
    navigation.goBack();
  };

  const activateSeedResetAction = React.useCallback(async () => {
    try {
      await withModal(async () => resetSeed(card, pin))();
      console.info(`[SatochipResetSeed] Seed reset successfully!`);
      setSuccess(true);
    } catch (error) {
      console.error(`[SatochipResetSeed] Failed to reset seed: ${error}`);
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
  }, [card, closeNfc, navigation, pin, withModal]);

  useEffect(() => {
    const isPinValid = pin?.length >= 4 && pin?.length <= 16;
    setCtaDisabled(!isPinValid || !isConfirmed);
  }, [pin, isConfirmed]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={styles.contentContainer}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Theme['fg-100'] }]}>
            Reset Satochip Seed
          </Text>
          <Text style={[styles.subtitle, { color: Theme['fg-150'] }]}>
            This will reset the Satochip seed and erase all private keys!
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: Theme['bg-100'] }]}>
          <FieldWithLabel
            label="Enter Satochip PIN"
            placeholder="Enter PIN"
            value={pin}
            onPress={() => {}}
            onChangeText={setPin}
            isActive={true}
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
              I understand that this process is irreversible
            </Text>
          </TouchableOpacity>
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
            onPress={activateSeedResetAction}
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
              {success ? 'Seed reset' : 'Failed to reset seed'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: Theme['fg-150'] }]}>
              {success
                ? 'Your card has been reset successfully! You can import a new BIP39 seed.'
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
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
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