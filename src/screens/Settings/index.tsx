import { useSnapshot } from 'valtio';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { getBuildNumber, getVersion } from 'react-native-device-info';
import SettingsStore from '@/store/SettingsStore';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import styles from './styles';
import { SettingsStackScreenProps } from '@/utils/TypesUtil';
import { storage } from '@/utils/storage';
import { PinModal } from '@/components/Modal/PinModal.tsx';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import { SatochipCard } from 'satochip-react-native';
import useSatochipModal from '@/hooks/useSatochipModal.ts';
import {
  getCardInfo,
  handleSatochipError,
} from '@/wallets/satochip/SatochipClientNew';
import RNModal from 'react-native-modal';
import { SatochipStatusModal } from '@/modals/SatochipStatusModal.tsx';

type Props = SettingsStackScreenProps<'Settings'>;

export default function Settings({navigation}: Props) {
  const Theme = useTheme();
  const {socketStatus} = useSnapshot(SettingsStore.state);
  const [clientId, setClientId] = useState('');

  // satochip mgmt
  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  // satochip
  const card = useRef(new SatochipCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);
  const [satochipSetupDone, setSatochipSetupDone] = useState(null);
  const [satochipIsSeeded, setSatochipIsSeeded] = useState(null);
  const [satochipIsAuthentic, setSatochipIsAuthentic] = useState(null);
  const [satochipStatusCode, setSatochipStatusCode] = useState(null);

  useEffect(() => {
    async function getAsyncData() {
      const _clientId = await storage.getItem('WALLETCONNECT_CLIENT_ID');
      if (_clientId) {
        setClientId(_clientId);
      }
    }
    getAsyncData();
  }, []);

  const copyToClipboard = (value: string) => {
    Clipboard.setString(value);
    Alert.alert('Value copied to clipboard');
  };

  const handleCheckStatus = () => {
    setShowPinModal(true);
  };

  // Handle the actual approval after PIN is entered
  const performCheckStatus = useCallback(
    async (userPin?: string) => {
      try {

        // if pin is defined, use it to verify PIN, as required for authenticity check
        const { setupDone, isSeeded, isAuthentic, authenticityMsg } = await withModal(async () => getCardInfo(card, userPin))();
        setSatochipSetupDone(setupDone);
        setSatochipIsSeeded(isSeeded);
        setSatochipIsAuthentic(isAuthentic);
        setSatochipStatusCode(authenticityMsg);
        setShowStatusModal(true);
      } catch (error) {
        const errorMessage = handleSatochipError(error);
        if (errorMessage) {
          //showToast(errorMessage, <ToastErrorIcon />, IToastCategory.DEFAULT, 3000, true); // TODO
        }
      } finally {
        closeNfc();
        await card.endNfcSession();
      }
    }, [card, closeNfc, withModal]);

  // Handle PIN submission
  const handlePinSubmit = useCallback(
    (userPin: string) => {
      setShowPinModal(false);
      performCheckStatus(userPin);
    },
    [performCheckStatus],
  );

  // Handle PIN modal cancel
  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
    performCheckStatus();
  }, [performCheckStatus]);

  const onClose = useCallback(() => {
    setShowStatusModal(false);
  }, []);

  return (
    <ScrollView
      style={[styles.header]}
      contentContainerStyle={[styles.content]}
      contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.subtitle, {color: Theme['fg-100']}]}>Device</Text>
      <View style={styles.sectionContainer}>
        <Card
          title="Client ID"
          value={clientId}
          onPress={() => copyToClipboard(clientId)}
        />
        <Card
          title="App version"
          value={`${getVersion()} (${getBuildNumber()})`}
        />
        <Card title="Socket status" value={socketStatus} />
        <Card
          title="WalletConnect logs"
          onPress={() => navigation.navigate('Logs')}
          icon="chevronRight"
        />
        <Card
          title="Application logs"
          onPress={() => navigation.navigate('AppLogs')}
          icon="chevronRight"
        />
      </View>

      <Text style={[styles.subtitle, {color: Theme['fg-100']}]}>Satochip options</Text>
      <View style={styles.sectionContainer}>
        <Card
          title="Check Card Status"
          value={"Check card setup, seed & authenticity status"}
          icon="chevronRight"
          onPress={() => handleCheckStatus()}
        />
        <Card
          title="Setup Satochip"
          value={"Set a PIN code for a Satochip"}
          icon="chevronRight"
          onPress={() => navigation.navigate('SatochipSetupCard')}
        />
        <Card
          title="Import BIP39 seed"
          value={"Import a seed into a Satochip"}
          icon="chevronRight"
          onPress={() => navigation.navigate("SatochipImportSeed")}
        />
        <Card
          title="Reset seed"
          value={"Reset a Satochip seed"}
          icon="chevronRight"
          onPress={() => navigation.navigate("SatochipResetSeed")}
        />
      </View>

      <PinModal
        visible={showPinModal}
        onSubmit={handlePinSubmit}
        onCancel={handlePinCancel}
        title={`Enter PIN to check authenticity`}
        minLength={4}
        maxLength={16}
        type={"PIN"}
      />

      <NfcPrompt visible={nfcVisible} close={closeNfc} />

      <RNModal
        backdropOpacity={0.6}
        hideModalContentWhileAnimating
        useNativeDriver
        statusBarTranslucent
        propagateSwipe
        onBackdropPress={onClose}
        onModalHide={onClose}
        style={styles.modal}
        isVisible={showStatusModal}>
        <SatochipStatusModal
          onClose={onClose}
          satochipSetupDone={satochipSetupDone}
          satochipIsSeeded={satochipIsSeeded}
          satochipIsAuthentic={satochipIsAuthentic}
          satochipStatusCode={satochipStatusCode}
        />
      </RNModal>

    </ScrollView>
  );
}