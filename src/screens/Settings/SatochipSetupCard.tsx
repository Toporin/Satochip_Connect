import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { SettingsStackScreenProps } from '@/utils/TypesUtil';
import { SatochipCard } from 'satochip-react-native';
import { handleSatochipError } from '@/wallets/satochip/SatochipClientNew';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import useSatochipModal from '@/hooks/useSatochipModal.ts';
import { setupCard } from '../../wallets/satochip/SatochipClientNew.ts';
import SuccessIllustration from '@/assets/images/illustration.svg';
import AlertIllustration from '@/assets/images/alert_illustration.svg';
import { CommonActions } from '@react-navigation/native';
import { FieldWithLabel } from '@/components/FieldWithLabel.tsx';

type Props = SettingsStackScreenProps<'SatochipSetupCard'>;

const INPUTS = {
  NONE: 'NONE',
  NEW_PIN: 'NEW_PIN',
  CONFIRM_PIN: 'CONFIRM_PIN',
};

export default function SatochipSetupCard({ navigation }: Props) {
  const Theme = useTheme();

  const [newPIN, setNewPIN] = useState('');
  const [confPIN, setConfPIN] = useState('');
  const [activeInput, setActiveInput] = useState(INPUTS.NONE);
  const [ctaDisabled, setCtaDisabled] = useState(true);

  const [success, setSuccess] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const card = useRef(new SatochipCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  const handleCancel = () => {
    navigation.goBack();
  };

  const setupPinAction = React.useCallback(async () => {
    try {
      await withModal(async () => setupCard(card, newPIN))();
      console.info(`[SatochipSetupCard] Card setup successfully!`);
      setSuccess(true);
    } catch (error) {
      console.error(`[SatochipSetupCard] Failed to setup card: ${error}`);
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
  }, [card, closeNfc, navigation, newPIN, withModal]);

  useEffect(() => {
    setCtaDisabled(
      !(
        newPIN?.length > 3 &&
        newPIN?.length <= 16 &&
        confPIN?.length > 3 &&
        confPIN?.length <= 16 &&
        newPIN === confPIN
      )
    );
  }, [newPIN, confPIN]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={styles.contentContainer}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Theme['fg-100'] }]}>
            Card setup
          </Text>
          <Text style={[styles.subtitle, { color: Theme['fg-150'] }]}>
            A PIN should be between 4 and 16 characters
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: Theme['bg-100'] }]}>
          <FieldWithLabel
            label="New PIN"
            placeholder="Enter new PIN"
            value={newPIN}
            onPress={() => setActiveInput(INPUTS.NEW_PIN)}
            onChangeText={setNewPIN}
            isActive={activeInput === INPUTS.NEW_PIN}
          />
          <FieldWithLabel
            label="Confirm PIN"
            placeholder="Re-enter PIN"
            value={confPIN}
            onPress={() => setActiveInput(INPUTS.CONFIRM_PIN)}
            onChangeText={setConfPIN}
            isActive={activeInput === INPUTS.CONFIRM_PIN}
          />
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
            onPress={setupPinAction}
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
              {success ? 'Card setup' : 'Failed to setup card'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: Theme['fg-150'] }]}>
              {success
                ? 'Your card has been setup successfully! You can now import a BIP39 seed.'
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