import {useSnapshot} from 'valtio';
import React, { useCallback, useRef, useState } from 'react';
import {Alert, View, StyleSheet} from 'react-native';
import {SignClientTypes} from '@walletconnect/types';

import {Methods} from '@/components/Modal/Methods';
import {Message} from '@/components/Modal/Message';

import {
  approveEIP155RequestEnhanced,
  rejectEIP155RequestEnhanced,
} from '@/utils/EnhancedEIP155RequestHandler';

import { SatochipCard } from 'satochip-react-native';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import useSatochipModal from '@/hooks/useSatochipModal.ts';

// Import the PinModal component
import { PinModal } from '@/components/Modal/PinModal';

import {walletKit} from '@/utils/WalletKitUtil';
import {handleRedirect} from '@/utils/LinkingUtils';
import ModalStore from '@/store/ModalStore';
import {RequestModal} from '@/modals/RequestModal';
import {Chains} from '@/components/Modal/Chains';
import {PresetsUtil} from '@/utils/PresetsUtil';
import { getEIP155AddressesFromParams } from '@/utils/HelperUtil.ts';
import SettingsStore from '@/store/SettingsStore.ts';
import { WalletType } from '@/types/WalletTypes.ts';
import { Addresses } from '@/components/Modal/Addresses.tsx';

export default function SessionSendTransactionModal() {
  const {data} = useSnapshot(ModalStore.state);
  const [isLoadingApprove, setIsLoadingApprove] = useState(false);
  const [isLoadingReject, setIsLoadingReject] = useState(false);

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);

  // satochip
  const card = useRef(new SatochipCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  // Get request and wallet data from store
  const requestEvent = data?.requestEvent;
  const session = data?.requestSession;

  const topic = requestEvent?.topic;
  const params = requestEvent?.params;
  const chainId = params?.chainId;
  const chain = PresetsUtil.getChainData(chainId || '');
  const request = params?.request;
  const transaction = request?.params[0];
  const method = requestEvent?.params?.request?.method!;
  const isLinkMode = session?.transportType === 'link_mode';
  const address = getEIP155AddressesFromParams(params);
  const wallet = SettingsStore.getWalletByAddress(address);
  const walletType = wallet?.type;

  const peerMetadata = session?.peer?.metadata as SignClientTypes.Metadata;

  // Handle the actual approval after PIN is entered
  const performApproval = useCallback(async (userPin: string) => {

    if (requestEvent && topic) {
      setIsLoadingApprove(true);
      try {

        const response = await approveEIP155RequestEnhanced(requestEvent, userPin, card, withModal, closeNfc);

        await walletKit.respondSessionRequest({
          topic,
          response,
        });

        handleRedirect({
          peerRedirect: peerMetadata?.redirect,
          isLinkMode: isLinkMode,
          error: 'error' in response ? response.error.message : undefined,
        });
      } catch (e) {
        const error = e as Error;
        console.error(error.message, 'error');
        // Show alert with validation error
        Alert.alert(
          'Error',
          `${error.message}`,
          [{ text: 'OK' }]
        );
      } finally {
        setIsLoadingApprove(false);
        ModalStore.close();
      }
    }
  }, [requestEvent, peerMetadata, topic, isLinkMode, card, withModal, closeNfc]);

  // Handle PIN submission
  const handlePinSubmit = useCallback((userPin: string) => {
    setShowPinModal(false);
    performApproval(userPin);
  }, [performApproval]);

  // Handle PIN modal cancel
  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
  }, []);

  // Handle approve action - shows PIN modal first for Satochip
  const onApprove = useCallback(async () => {
    if (walletType === WalletType.SATOCHIP) {
      setShowPinModal(true);
    } else if (walletType === WalletType.SOFTWARE) {
      if (await wallet?.isAvailable()) {
        // Do not ask password if already cached
        await performApproval('');
      } else {
        setShowPinModal(true);
      }
    } else {
      // TODO: support satodime
      await performApproval('');
    }
  }, [performApproval, wallet, walletType]);

  // Handle reject action
  const onReject = useCallback(async () => {

    if (requestEvent && topic) {
      setIsLoadingReject(true);
      const response = rejectEIP155RequestEnhanced(requestEvent);
      try {
        await walletKit.respondSessionRequest({
          topic,
          response,
        });
      } catch (e) {
        console.error((e as Error).message, 'error');
      } finally {
        setIsLoadingReject(false);
        ModalStore.close();
      }
    }
  }, [requestEvent, topic]);

  return (
    <>
      <RequestModal
        intention="sign a transaction"
        metadata={peerMetadata}
        onApprove={onApprove}
        onReject={onReject}
        isLinkMode={isLinkMode}
        approveLoader={isLoadingApprove}
        rejectLoader={isLoadingReject}>
        <View style={styles.container}>
          {chain ? <Chains chains={[chain]} /> : null}
          {address ? <Addresses addresses={[address]} /> : null}
          <Methods methods={[method]} />
          <Message message={JSON.stringify(transaction, null, 2)} />
        </View>
      </RequestModal>

      <PinModal
        visible={showPinModal}
        onSubmit={handlePinSubmit}
        onCancel={handlePinCancel}
        title={`Enter ${walletType===WalletType.SATOCHIP? "PIN" : "password"} to Sign Message`}
        minLength={walletType===WalletType.SATOCHIP? 4 : 8}
        maxLength={walletType===WalletType.SATOCHIP? 16 : 64}
        type={walletType===WalletType.SATOCHIP? "PIN" : "password"}
      />

      <NfcPrompt visible={nfcVisible} close={closeNfc} />

    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
    paddingHorizontal: 16,
    rowGap: 8,
  },
});
