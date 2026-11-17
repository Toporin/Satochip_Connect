import { useSnapshot } from 'valtio';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SignClientTypes } from '@walletconnect/types';

import { Methods } from '@/components/Modal/Methods';
import { Message } from '@/components/Modal/Message';
import {
  getEIP155AddressesFromParams,
  getSignParamsMessage,
} from '@/utils/HelperUtil';

import {
  approveEIP155RequestEnhanced,
  rejectEIP155RequestEnhanced,
} from '@/utils/EnhancedEIP155RequestHandler';

import { walletKit } from '@/utils/WalletKitUtil';
import { handleRedirect } from '@/utils/LinkingUtils';
import ModalStore from '@/store/ModalStore';
import { RequestModal } from './RequestModal';
import { Chains } from '@/components/Modal/Chains';
import { Addresses } from '@/components/Modal/Addresses';
import { PresetsUtil } from '@/utils/PresetsUtil';
import useRequestWallet from '@/hooks/useRequestWallet';
import { AccountSelector } from '@/components/Modal/AccountSelector';
import { PinModal } from '@/components/Modal/PinModal.tsx';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import { WalletType } from '@/types/WalletTypes.ts';

export default function SessionSignModal() {
  // Get request and wallet data from store
  const { data } = useSnapshot(ModalStore.state);
  const requestEvent = data?.requestEvent;
  const session = data?.requestSession;
  const isLinkMode = session?.transportType === 'link_mode';

  const [isLoadingApprove, setIsLoadingApprove] = useState(false);
  const [isLoadingReject, setIsLoadingReject] = useState(false);

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);

  // Get required request data
  const { topic, params } = requestEvent!;
  const { request, chainId } = params;
  const chain = PresetsUtil.getChainData(chainId);
  const peerMetadata = session?.peer?.metadata as SignClientTypes.Metadata;
  const method = requestEvent?.params?.request?.method!;

  // Get message, convert it to UTF8 string if it is valid hex
  const message = getSignParamsMessage(request.params);
  const address = getEIP155AddressesFromParams(params);
  // Account that signs: several accounts can share this address (e.g. a software
  // account restored from a Satochip seed), the user then picks one.
  const {
    candidates,
    wallet,
    needsChoice,
    selectWallet,
    card,
    withModal,
    nfcVisible,
    closeNfc,
  } = useRequestWallet(address);
  const walletType = wallet?.type;

  // Handle the actual approval after PIN is entered
  const performApproval = useCallback(
    async (userPin: string) => {

      if (requestEvent && topic) {
        setIsLoadingApprove(true);
        try {
          const response = await approveEIP155RequestEnhanced(
            requestEvent,
            userPin,
            card,
            withModal,
            closeNfc,
            wallet,
          );

          await walletKit.respondSessionRequest({
            topic,
            response,
          });

          handleRedirect({
            peerRedirect: peerMetadata?.redirect,
            isLinkMode: isLinkMode,
            error: 'error' in response ? response.error.message : undefined,
          });

          console.info(`[SessionSignModal] Message signature approved by user`);
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
    },
    [requestEvent, peerMetadata, topic, isLinkMode, card, withModal, closeNfc, wallet],
  );

  // Handle PIN submission
  const handlePinSubmit = useCallback(
    (userPin: string) => {
      setShowPinModal(false);
      performApproval(userPin);
    },
    [performApproval],
  );

  // Handle PIN modal cancel
  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
  }, []);

  // Handle approve action - shows PIN modal first for Satochip
  const onApprove = useCallback(async () => {
    if (needsChoice) {
      Alert.alert('Choose an account', 'Several accounts use this address. Select the account to sign with.');
      return;
    }
    if (walletType === WalletType.SATOCHIP) {
      setShowPinModal(true);
    } else if (walletType === WalletType.SOFTWARE) {
      if (await wallet?.isAvailable()) {
        // Do not ask password if already cached
        await performApproval('');
      } else {
        setShowPinModal(true);
      }
    } else if (walletType === WalletType.SATODIME) {
      // Satodime: no PIN, the card is scanned directly
      await performApproval('');
    } else {
      await performApproval('');
    }
  }, [performApproval, wallet, walletType, needsChoice]);

  // Handle reject action
  const onReject = useCallback(async () => {
    if (requestEvent) {
      setIsLoadingReject(true);
      const response = rejectEIP155RequestEnhanced(requestEvent);
      try {
        await walletKit.respondSessionRequest({
          topic,
          response,
        });
        handleRedirect({
          peerRedirect: peerMetadata?.redirect,
          isLinkMode: isLinkMode,
          error: 'User rejected signature request',
        });
        console.info(`[SessionSignModal] Message signature rejected by user`);
      } catch (e) {
        setIsLoadingReject(false);
        console.error((e as Error).message, 'error');
        return;
      }
      setIsLoadingReject(false);
      ModalStore.close();
    }
  }, [requestEvent, topic, peerMetadata, isLinkMode]);

  // Ensure request and wallet are defined
  if (!requestEvent || !session) {
    return <Text>Missing request data</Text>;
  }

  return (
    <>
      <RequestModal
        intention="wants to request a signature"
        metadata={peerMetadata}
        onApprove={onApprove}
        onReject={onReject}
        isLinkMode={isLinkMode}
        approveLoader={isLoadingApprove}
        rejectLoader={isLoadingReject}
      >
        <View style={styles.container}>
          {chain ? <Chains chains={[chain]} /> : null}
          {address ? <Addresses addresses={[address]} /> : null}
          {candidates.length > 1 ? (
            <AccountSelector wallets={candidates} selectedId={wallet?.id} onSelect={selectWallet} />
          ) : null}
          <Methods methods={[method]} />
          <Message message={message} />
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
