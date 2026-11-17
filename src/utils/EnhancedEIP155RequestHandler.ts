/**
 * Enhanced EIP155 Request Handler with Hardware Wallet Support
 * This shows how the existing request handler would be updated to use the new wallet abstraction
 */

import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils';
import { SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { SatochipCard, SatodimeCard } from 'satochip-react-native';

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
  validateTransaction,
} from '@/utils/HelperUtil';
import { EIP155_SIGNING_METHODS } from '@/constants/Eip155';
import SettingsStore from '@/store/SettingsStore.ts';
import { SatochipWallet } from '@/wallets/satochip/SatochipWallet.ts';
import { SatodimeWallet } from '@/wallets/satodime/SatodimeWallet';
import { runSatodimeSigning } from '@/wallets/satodime/runSatodimeSigning';
import { EIP155SoftwareWallet } from '@/wallets/EIP155SoftwareWallet.ts';
import { extractChainId, broadcastTransaction } from '@/utils/EIP155Utils';

type RequestEventArgs = Omit<
  SignClientTypes.EventArguments['session_request'],
  'verifyContext'
>;

/**
 * Account that signs for `address`.
 *
 * Several accounts can share an address (e.g. a software account restored from
 * the seed of a Satochip card). Picking the first match would sign with the
 * wrong account type (card PIN used as a password), so when the address is
 * ambiguous the caller must say which account to use.
 */
export function resolveSigningWallet(
  address: string,
  signingWallet?: IWalletProvider,
): IWalletProvider {
  if (signingWallet) {
    if (signingWallet.address.toLowerCase() !== address.toLowerCase()) {
      throw new WalletError(
        WalletErrorType.INVALID_ADDRESS,
        `Selected account does not match request address: ${address}`,
      );
    }
    return signingWallet;
  }
  const candidates = SettingsStore.getWalletsByAddress(address);
  if (candidates.length === 0) {
    throw new WalletError(
      WalletErrorType.DEVICE_NOT_FOUND,
      `No wallet found for address: ${address}`,
    );
  }
  if (candidates.length > 1) {
    throw new WalletError(
      WalletErrorType.WALLET_NOT_SET,
      `Several accounts use address ${address}. Choose the account to sign with.`,
    );
  }
  return candidates[0];
}

/**
 * Enhanced approve function that handles both software and hardware wallets
 */
export async function approveEIP155RequestEnhanced(
  requestEvent: RequestEventArgs,
  pin: string, // PIN for Satochip, password for software wallet (unused for Satodime)
  card: SatochipCard | SatodimeCard,
  withModal: any,
  closeNfc: any,
  signingWallet?: IWalletProvider, // account chosen by the caller (several accounts can share an address)
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

    wallet = resolveSigningWallet(address, signingWallet);

    // for software wallet, decrypt sensitive info using user credentials
    const walletType = wallet.type;
    if (
      walletType === WalletType.SOFTWARE &&
      !(await wallet.isAvailable())
    ) {
      // unlock wallet with user provided password
      await (wallet as EIP155SoftwareWallet).unlockWallet(pin);
      // keep the public key recorded at unlock (used for QR pairing)
      SettingsStore.rememberSoftwarePublicKeys();
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
              card as SatochipCard,
              pin,
              address,
              chainId,
            ),
          )();
        } else if (wallet.type === WalletType.SATODIME) {
          const satodime = wallet as SatodimeWallet;
          signedMessage = await runSatodimeSigning(satodime.satodimeInfo, card as SatodimeCard, withModal, closeNfc, options =>
            satodime.signEthereumMessage(message, card as SatodimeCard, address, chainId, options),
          );
        } else {
          // software wallet
          signedMessage = await (wallet as ISoftwareWallet).signMessage(
            message,
          );
        }
        console.info(`Signed message for address: ${address}`);
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
              card as SatochipCard,
              pin,
              address,
              chainId,
            ),
          )();
        } else if (wallet.type === WalletType.SATODIME) {
          const satodime = wallet as SatodimeWallet;
          signedData = await runSatodimeSigning(satodime.satodimeInfo, card as SatodimeCard, withModal, closeNfc, options =>
            satodime.signEIP712TypedData(domain, types, data, card as SatodimeCard, address, chainId, options),
          );
        } else {
          // Software wallets can handle typed data directly
          signedData = await (wallet as ISoftwareWallet).signTypedData(
            domain,
            types,
            data,
          );
        }
        console.info(`Signed Typed Data for address: ${address}`);
        return formatJsonRpcResult(id, signedData);
      }

      case EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TRANSACTION: {
        const transaction = request.params[0];
        console.log('approveEIP155RequestEnhanced unsignedTx:', transaction);

        // Validate transaction
        let validatedTransaction = await validateTransaction(transaction, chainId);

        let signedTx;
        if (wallet.type === WalletType.SATOCHIP) {
          // Use high-level SatochipWallet method
          signedTx = await withModal(async () =>
            (wallet as SatochipWallet).signEthereumTransaction(
              validatedTransaction,
              card as SatochipCard,
              pin,
              address,
              chainId,
            ),
          )();
        } else if (wallet.type === WalletType.SATODIME) {
          const satodime = wallet as SatodimeWallet;
          signedTx = await runSatodimeSigning(satodime.satodimeInfo, card as SatodimeCard, withModal, closeNfc, options =>
            satodime.signEthereumTransaction(validatedTransaction, card as SatodimeCard, address, chainId, options),
          );
        } else {
          // Software wallets can handle full transaction objects
          signedTx = await (wallet as ISoftwareWallet).signTransaction(
            validatedTransaction,
          );
        }
        console.log('approveEIP155RequestEnhanced signedTx:', signedTx);

        // Return signedTx or txHash based on method type
        if (request.method === EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION) {
          // Broadcast and return transaction hash
          const txHash = await broadcastTransaction(signedTx, chainId);
          console.info(`Broadcast transaction with hash ${txHash} for address: ${address}`);
          return formatJsonRpcResult(id, txHash);
        } else {
          // Return signed transaction for eth_signTransaction
          console.info(`Signed transaction for address: ${address}`);
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
    if (wallet && wallet.type === WalletType.SATODIME && error instanceof Error) {
      // Satodime checks (wrong card, sealed vault, ownership...) must be shown to the user
      return formatJsonRpcError(id, error.message);
    }
    return formatJsonRpcError(id, 'An error occurred'); // generic error message
  } finally {
    if (wallet && (wallet.type === WalletType.SATOCHIP || wallet.type === WalletType.SATODIME)) {
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
