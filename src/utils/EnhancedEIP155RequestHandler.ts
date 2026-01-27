/**
 * Enhanced EIP155 Request Handler with Hardware Wallet Support
 * This shows how the existing request handler would be updated to use the new wallet abstraction
 */

import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils';
import { SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { SatochipCard } from 'satochip-react-native';

import {
  ISoftwareWallet,
  IWalletProvider,
  WalletError,
  WalletErrorType,
  WalletType,
} from '@/types/WalletTypes';

import {
  getEIP155AddressesFromParams,
  getSignParamsMessage,
  getSignTypedDataParamsData,
  validateTransactionAddresses,
} from '@/utils/HelperUtil';
import { EIP155_SIGNING_METHODS } from '@/constants/Eip155';
import SettingsStore from '@/store/SettingsStore.ts';
import { SatochipWallet } from '@/wallets/satochip/SatochipWallet.ts';
import { EIP155SoftwareWallet } from '@/wallets/EIP155SoftwareWallet.ts';
import { extractChainId, broadcastTransaction } from '@/utils/EIP155Utils';

type RequestEventArgs = Omit<
  SignClientTypes.EventArguments['session_request'],
  'verifyContext'
>;

/**
 * Enhanced approve function that handles both software and hardware wallets
 */
export async function approveEIP155RequestEnhanced(
  requestEvent: RequestEventArgs,
  pin: string, // PIN for hardware wallets, password for software wallet
  card: SatochipCard,
  withModal: any,
  closeNfc: any,
) {

  const { params, id } = requestEvent;
  const { request } = params;

  // Get the address from params
  const address = getEIP155AddressesFromParams(params);
  console.log(`approveEIP155RequestEnhanced address: ${address}`);

  // Get chainId from params
  const chainId = extractChainId(params.chainId); // params.chainId is a string with format: "eip155:1"
  console.log(`approveEIP155RequestEnhanced Signing chainId: ${chainId}`);

  let wallet: IWalletProvider | undefined;
  try {

    wallet = SettingsStore.getWalletByAddress(address);
    if (!wallet) {
      throw new WalletError(
        WalletErrorType.DEVICE_NOT_FOUND,
        `No wallet found for address: ${address}`,
      );
    }

    // for software wallet, decrypt sensitive info using user credentials
    const walletType = wallet.type;
    if (
      walletType === WalletType.SOFTWARE &&
      !(await wallet.isAvailable())
    ) {
      // unlock wallet with user provided password
      await (wallet as EIP155SoftwareWallet).unlockWallet(pin);
    }

    // Handle different signing methods
    switch (request.method) {
      case EIP155_SIGNING_METHODS.PERSONAL_SIGN:
      case EIP155_SIGNING_METHODS.ETH_SIGN: {
        const message = getSignParamsMessage(request.params);
        if (!message) {
          throw new WalletError(
            WalletErrorType.SIGNING_FAILED,
            'Message is empty',
          );
        }

        let signedMessage: string;
        if (wallet.type === WalletType.SATOCHIP) {
          // Use high-level SatochipWallet method
          signedMessage = await withModal(async () =>
            (wallet as SatochipWallet).signEthereumMessage(
              message,
              card,
              pin,
              address,
              chainId,
            ),
          )();
        } else {
          // software wallet
          signedMessage = await (wallet as ISoftwareWallet).signMessage(
            message,
          );
        }

        return formatJsonRpcResult(id, signedMessage);
      }

      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V3:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4: {
        const { domain, types, message: data } = getSignTypedDataParamsData(
          request.params,
        );
        delete types.EIP712Domain;

        let signedData;
        if (wallet.type === WalletType.SATOCHIP) {
          // Use high-level SatochipWallet method
          signedData = await withModal(async () =>
            (wallet as SatochipWallet).signEIP712TypedData(
              domain,
              types,
              data,
              card,
              pin,
              address,
              chainId,
            ),
          )();
        } else {
          // Software wallets can handle typed data directly
          signedData = await (wallet as ISoftwareWallet).signTypedData(
            domain,
            types,
            data,
          );
        }

        return formatJsonRpcResult(id, signedData);
      }

      case EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TRANSACTION: {
        const transaction = request.params[0];

        // Validate transaction addresses
        const validatedTransaction = validateTransactionAddresses(transaction);

        let signedTx;
        if (wallet.type === WalletType.SATOCHIP) {
          // Use high-level SatochipWallet method
          signedTx = await withModal(async () =>
            (wallet as SatochipWallet).signEthereumTransaction(
              validatedTransaction,
              card,
              pin,
              address,
              chainId,
            ),
          )();
        } else {
          // Software wallets can handle full transaction objects
          signedTx = await (wallet as ISoftwareWallet).signTransaction(
            validatedTransaction,
          );
        }

        // Return signedTx or txHash based on method type
        if (request.method === EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION) {
          // Broadcast and return transaction hash
          const txHash = await broadcastTransaction(signedTx, chainId);
          console.log('approveEIP155RequestEnhanced txHash:', txHash);
          return formatJsonRpcResult(id, txHash);
        } else {
          // Return signed transaction for eth_signTransaction
          return formatJsonRpcResult(id, signedTx);
        }
      }

      default:
        throw new WalletError(
          WalletErrorType.UNSUPPORTED_OPERATION,
          `Unsupported method: ${request.method}`,
        );
    }
  } catch (error: any) {
    console.error('Error in enhanced EIP155 request handler:', error);
    return formatJsonRpcError(id, 'An error occurred'); // generic error message
  } finally {
    if (wallet && wallet.type === WalletType.SATOCHIP) {
      closeNfc();
      await card.endNfcSession();
    }
  }
}

/**
 * Enhanced reject function
 */
export function rejectEIP155RequestEnhanced(request: RequestEventArgs) {
  const { id } = request;
  return formatJsonRpcError(id, getSdkError('USER_REJECTED').message);
}
