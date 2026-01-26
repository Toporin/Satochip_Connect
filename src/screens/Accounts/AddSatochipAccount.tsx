import React, { useCallback, useRef, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AccountsStackScreenProps } from '@/utils/TypesUtil';
import addAccountStyles from './addAccountStyles';
import { SatochipCard } from 'satochip-react-native';
import {
  getCardInfo,
  getSatochipDetails,
  handleSatochipError,
} from '@/wallets/satochip/SatochipClientNew';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import useSatochipModal from '@/hooks/useSatochipModal.ts';
import setupStyles from '@/screens/Accounts/setupStyles.ts';
import { hp } from '@/constants/responsive.tsx';

type Props = AccountsStackScreenProps<'AddSatochipAccount'>;

export default function AddSatochipAccountScreen({ navigation }: Props) {
  const Theme = useTheme();
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pin, setPin] = useState('');
  const [satochipSetupDone, setSatochipSetupDone] = useState(null);
  const [satochipIsSeeded, setSatochipIsSeeded] = useState(null);
  const [satochipIsAuthentic, setSatochipIsAuthentic] = useState(null);
  const [satochipStatusCode, setSatochipStatusCode] = useState(null);

  const card = useRef(new SatochipCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  const handleScanCard = useCallback(async () => {
    try {

      // if pin is defined, use it to verify PIN, as required for authenticity check
      const { setupDone, isSeeded, isAuthentic, authenticityMsg } = await withModal(async () => getCardInfo(card, pin))();
      setSatochipSetupDone(setupDone);
      setSatochipIsSeeded(isSeeded);
      setSatochipIsAuthentic(isAuthentic);
      setSatochipStatusCode(authenticityMsg);

      const { xpub, masterFingerprint  } = await withModal(async () =>
        getSatochipDetails(card, pin,"m/44'/60'/0'/")
      )();

      // Navigate to setup screen
      navigation.navigate('SatochipSetup', { masterXfp: masterFingerprint, xpub, isAuthentic, authenticityMsg });

    } catch (error) {
      const errorMessage = handleSatochipError(error);
      if (errorMessage) {
        //showToast(errorMessage, <ToastErrorIcon />, IToastCategory.DEFAULT, 3000, true); // TODO
      }
    } finally {
      closeNfc();
      card.endNfcSession();
    }
  }, [card, closeNfc, navigation, pin, withModal]);

  return (
    <ScrollView
      style={[addAccountStyles.container, { backgroundColor: Theme['bg-100'] }]}
      contentContainerStyle={addAccountStyles.content}
      contentInsetAdjustmentBehavior="automatic">

      <NfcPrompt visible={nfcVisible} close={closeNfc} />

      <View style={addAccountStyles.header}>
        <Text style={[addAccountStyles.title, { color: Theme['fg-100'] }]}>
          Add Satochip Account
        </Text>
        <Text style={[addAccountStyles.subtitle, { color: Theme['fg-150'] }]}>
          Connect your Satochip hardware wallet to add a new account
        </Text>
      </View>

      <View style={[addAccountStyles.instructionCard, { backgroundColor: Theme['bg-175'] }]}>
        <Text style={[addAccountStyles.instructionTitle, { color: Theme['fg-100'] }]}>
          Before you start:
        </Text>
        <View style={addAccountStyles.instructionList}>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • Make sure NFC is enabled on your device
          </Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • Have your Satochip card ready
          </Text>
          <Text style={[addAccountStyles.instructionItem, { color: Theme['fg-150'] }]}>
            • Know your card's PIN if it's already set up
          </Text>
        </View>
      </View>

      <View style={[setupStyles.formGroup, { marginBottom: hp(30) }]}>
        <Text style={[setupStyles.formLabel, { color: Theme['fg-100'] }]}>
          Card PIN
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
          placeholder="Enter your card PIN"
          placeholderTextColor={Theme['fg-300']}
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          //keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={16}
        />
      </View>


      <View style={addAccountStyles.scanSection}>
        {/*<View style={[addAccountStyles.scanCard, { backgroundColor: Theme['bg-175'] }]}>*/}
        {/*  {isScanning && (*/}
        {/*    <ActivityIndicator */}
        {/*      size="large" */}
        {/*      color={Theme['accent-100']} */}
        {/*      style={addAccountStyles.loadingIndicator}*/}
        {/*    />*/}
        {/*  )}*/}
        {/*  */}
        {/*  {isConnecting && (*/}
        {/*    <View style={addAccountStyles.connectingState}>*/}
        {/*      <ActivityIndicator size="large" color={Theme['accent-100']} />*/}
        {/*      <Text style={[addAccountStyles.connectingText, { color: Theme['fg-100'] }]}>*/}
        {/*        Connecting to card...*/}
        {/*      </Text>*/}
        {/*    </View>*/}
        {/*  )}*/}

        {/*  {!isScanning && !isConnecting && (*/}
        {/*    <>*/}
        {/*      <Text style={[addAccountStyles.scanTitle, { color: Theme['fg-100'] }]}>*/}
        {/*        Ready to Scan*/}
        {/*      </Text>*/}
        {/*      <Text style={[addAccountStyles.scanDescription, { color: Theme['fg-150'] }]}>*/}
        {/*        Tap the button below and then hold your Satochip card near the back of your device*/}
        {/*      </Text>*/}
        {/*    </>*/}
        {/*  )}*/}

        {/*  {isScanning && (*/}
        {/*    <Text style={[addAccountStyles.scanningText, { color: Theme['fg-100'] }]}>*/}
        {/*      Hold your card near the device...*/}
        {/*    </Text>*/}
        {/*  )}*/}
        {/*</View>*/}

        <TouchableOpacity
          style={[
            addAccountStyles.scanButton,
            { 
              backgroundColor: (isScanning || isConnecting) 
                ? Theme['bg-250'] 
                : Theme['accent-100'] 
            }
          ]}
          onPress={handleScanCard}
          disabled={isScanning || isConnecting || !pin }>
          <Text style={[
            addAccountStyles.scanButtonText,
            { 
              color: (isScanning || isConnecting || !pin )
                ? Theme['fg-300'] 
                : Theme['inverse-100'] 
            }
          ]}>
            {isScanning ? 'Scanning...' : isConnecting ? 'Connecting...' : 'Scan Satochip Card'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[addAccountStyles.helpCard, { backgroundColor: Theme['bg-175'] }]}>
        <Text style={[addAccountStyles.helpTitle, { color: Theme['fg-100'] }]}>
          Need help?
        </Text>
        <Text style={[addAccountStyles.helpDescription, { color: Theme['fg-150'] }]}>
          Make sure your Satochip card is working properly and that NFC is enabled on your device. 
          The card should be held close to the NFC antenna, usually located on the back of your phone.
        </Text>
      </View>
    </ScrollView>
  );
}