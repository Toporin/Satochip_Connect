// TODO complete satochip support

import {useSnapshot} from 'valtio';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {SignClientTypes, AuthTypes} from '@walletconnect/types';
import {buildAuthObject, populateAuthPayload} from '@walletconnect/utils';
import { ethers } from 'ethers';

import ModalStore from '@/store/ModalStore';
import {walletKit} from '@/utils/WalletKitUtil';
import SettingsStore from '@/store/SettingsStore';
import {handleRedirect} from '@/utils/LinkingUtils';
import {useTheme} from '@/hooks/useTheme';

import {RequestModal} from './RequestModal';
import {Message} from '@/components/Modal/Message';
import { EIP155_CHAINS, EIP155_SIGNING_METHODS } from '@/constants/Eip155';
import { SatochipCard } from 'satochip-react-native';
import useSatochipModal from '@/hooks/useSatochipModal.ts';
import { PinModal } from '@/components/Modal/PinModal.tsx';
import NfcPrompt from '@/components/NfcPromptAndroid.tsx';
import settingsStore from '@/store/SettingsStore';
import { SatochipWallet } from '@/wallets/satochip/SatochipWallet.ts';
import {signWithSatochip} from '@/wallets/satochip/SatochipClientNew.ts';

export default function SessionAuthenticateModal() {
  const Theme = useTheme();
  const {data} = useSnapshot(ModalStore.state);
  const {isLinkModeRequest} = useSnapshot(SettingsStore.state);

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  // satochip
  const card = useRef(new SatochipCard()).current;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  const authRequest =
    data?.authRequest as SignClientTypes.EventArguments['session_authenticate'];

  const [messages, setMessages] = useState<
    {authPayload: any; message: string; id: number; iss: string}[]
  >([]);

  // the chains that are supported by the wallet from the proposal
  const supportedChains = useMemo(() => {
    const chains = authRequest.params.authPayload.chains.filter(
      chain => !!EIP155_CHAINS[chain],
    );
    return chains;
  }, [authRequest]);

  const [supportedMethods] = useState<string[]>(
    Object.values(EIP155_SIGNING_METHODS),
  );

  // TODO: Add checkbox to change strategy
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [signStrategy, setSignStrategy] = useState<'one' | 'all'>('one');

  const [isLoadingApprove, setIsLoadingApprove] = useState(false);
  const [isLoadingReject, setIsLoadingReject] = useState(false);

  //const {account} = useSnapshot(SettingsStore.state);
  //const address = eip155Addresses[account];
  const wallets = settingsStore.getSatochipWallets();
  const wallet = wallets[0]; // use first wallet by default, TODO: let user select wallet
  const address = wallet.address;

  // Handle approve action - shows PIN modal first
  const onApprove = useCallback(async () => {
    setShowPinModal(true);
  }, []);

  // Handle approve action, construct session namespace
  const performApproval = useCallback(async (userPin: string) => {

    if (messages.length > 0) {
      try {
        setIsLoadingApprove(true);
        const signedAuths: AuthTypes.Cacao[] = [];

        messages.forEach(async message => {

          // TODO: sign message with satochip
          // // compute hash
          // const messageBytes = ethers.utils.isHexString(message.message)
          //   ? ethers.utils.arrayify(message.message)  // v5: arrayify instead of getBytes
          //   : ethers.utils.toUtf8Bytes(message.message);
          // const hashHexString = ethers.utils.hashMessage(messageBytes);
          // console.log("SessionAuthenticateModal hashHexString:", hashHexString);
          // const hashBytes = Buffer.from(hashHexString.slice(2), 'hex');
          // console.log(`SessionAuthenticateModal hashBytes: ${hashBytes.toString('hex')}`);
          //
          // // sign hash
          // const satochipInfo = (wallet as SatochipWallet).satochipInfo;
          // console.log('SessionAuthenticateModal satochipInfo:', satochipInfo);
          //
          // const derSig  = await withModal(
          //   async () => signWithSatochip(
          //     card,
          //     satochipInfo.masterXfp,
          //     satochipInfo.derivationPath,
          //     hashBytes,
          //     userPin
          //   )
          // )();
          // console.log(`SessionAuthenticateModal derSig: ${derSig.toString('hex')}`);
          //
          // // Step 3: Parse DER signature to get r and s
          // const { r, s } = parseDERSignature(derSig);
          // console.log('SessionAuthenticateModal Signature components - r:', r, 's:', s);
          //
          // // Step 4: Recover v value
          // const txType = 1; // anything except 0, returns a value between 0 and 1
          // const v = await recoverVValue(
          //   hashHexString,
          //   r,
          //   s,
          //   address,
          //   chainId,
          //   txType
          // );
          // console.log('SessionAuthenticateModal Recovered v value:', v);
          //
          // // concatenate values to get signature
          // const signature = r + s.slice(2) + v.toString(16).padStart(2, '0');
          // console.log('SessionAuthenticateModal signedMessage:', signature);

          const signature = "TODO";

          const signedCacao = buildAuthObject(
            message.authPayload,
            {
              t: 'eip191',
              s: signature,
            },
            message.iss,
          );
          signedAuths.push(signedCacao);
        });
        await walletKit.approveSessionAuthenticate({
          id: messages[0].id,
          auths: signedAuths,
        });

        SettingsStore.setSessions(Object.values(walletKit.getActiveSessions()));

        handleRedirect({
          peerRedirect: authRequest.params.requester?.metadata?.redirect,
          isLinkMode: isLinkModeRequest
        });
      } catch (e) {
        console.error((e as Error).message, 'error');
        return;
      }
    }
    setIsLoadingApprove(false);
    SettingsStore.setIsLinkModeRequest(false);
    ModalStore.close();
  }, [wallet, address, messages, authRequest, isLinkModeRequest, card, withModal, closeNfc]);

  // Handle PIN submission
  const handlePinSubmit = useCallback((userPin: string) => {
    setShowPinModal(false);
    performApproval(userPin);
  }, [performApproval]);

  // Handle PIN modal cancel
  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
  }, []);

  // Handle reject action
  const onReject = useCallback(async () => {
    if (authRequest) {
      try {
        setIsLoadingReject(true);
        await walletKit.rejectSessionAuthenticate({
          id: authRequest.id,
          reason: {
            code: 12001,
            message: 'User rejected auth request',
          },
        });
        handleRedirect({
          peerRedirect: authRequest.params.requester?.metadata?.redirect,
          isLinkMode: SettingsStore.state.isLinkModeRequest,
          error: 'User rejected auth request',
        });
      } catch (e) {
        console.error((e as Error).message, 'error');
        return;
      }
    }
    setIsLoadingReject(false);
    SettingsStore.setIsLinkModeRequest(false);
    ModalStore.close();
  }, [authRequest]);

  useEffect(() => {
    if (authRequest && supportedChains && supportedMethods) {
      const authPayload = populateAuthPayload({
        authPayload: authRequest.params.authPayload,
        chains: supportedChains,
        methods: supportedMethods,
      });
      const iss = `${authPayload.chains[0]}:${address}`;

      if (signStrategy === 'one') {
        const message = walletKit.formatAuthMessage({
          request: authPayload,
          iss,
        });
        setMessages([{authPayload, message, id: authRequest.id, iss}]);
      } else if (signStrategy === 'all') {
        const messagesToSign: any[] = [];
        authPayload.chains.forEach((chain: string) => {
          const message = walletKit.formatAuthMessage({
            request: authPayload,
            iss: `${chain}:${address}`,
          });
          messagesToSign.push({authPayload, message, id: authRequest.id, iss});
        });
        setMessages(messagesToSign);
      }
    }
  }, [signStrategy, authRequest, supportedChains, supportedMethods, address]);

  return (
    <>
      <RequestModal
        intention="wants to request a signature"
        metadata={authRequest.params.requester.metadata}
        onApprove={onApprove}
        onReject={onReject}
        isLinkMode={isLinkModeRequest}
        approveLoader={isLoadingApprove}
        rejectLoader={isLoadingReject}>
        <View style={[styles.divider, {backgroundColor: Theme['bg-300']}]} />
        <View style={styles.container}>
          <Text>{`Messages to sign (${messages?.length})`}</Text>
          <Message
            showTitle={false}
            message={messages.map(m => `${m.message}\n\n`).toString()}
            style={styles.messageContainer}
          />
        </View>
      </RequestModal>

      <PinModal
        visible={showPinModal}
        onSubmit={handlePinSubmit}
        onCancel={handlePinCancel}
        title="Enter PIN to Sign Message"
        minLength={4}
        maxLength={16}
      />

      <NfcPrompt visible={nfcVisible} close={closeNfc} />

    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },
  container: {
    paddingHorizontal: 16,
    marginBottom: 8,
    rowGap: 8,
  },
  messageContainer: {
    maxHeight: 250,
  },
});
