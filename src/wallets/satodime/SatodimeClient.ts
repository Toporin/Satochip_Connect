/**
 * Satodime card operations used by the app: scanning a card, taking or proving
 * ownership, and signing a digest with a vault after checking that the card
 * and vault match the account.
 *
 * All functions must run inside an NFC session (card.nfcWrapper / withModal).
 * Never log unlock secrets, CVCs or private keys.
 */
import { ethers } from 'ethers';
import type { SatodimeCard, CardVersion } from 'satochip-react-native';
import { cvcToUnlockSecret, formatCardVersion } from 'satochip-react-native';

import { SecretStore } from '@/utils/SecretStore';
import { SatodimeInfo, SatodimeVaultState } from '@/types/WalletTypes';
import { decodeSatodimeSlip44, SatodimeNetwork } from '@/constants/Satodime';

/** Satodime status words (see satochip-react-native SatodimeConstants). */
const SW_INCORRECT_UNLOCK_CODE = 0x9C51;
const SW_INCORRECT_UNLOCK_COUNTER = 0x9C50;
const SW_INCORRECT_KEYSLOT_STATE = 0x9C52;

export type SatodimeOwnership =
  /** this device holds a valid unlock secret */
  | 'owner'
  /** card has no owner: it can be claimed from this app */
  | 'unclaimed'
  /** card owned elsewhere, but has a fixed CVC that the user can type */
  | 'cvc-required'
  /** card owned by another device: refuse */
  | 'owned-elsewhere';

export interface ScannedVault {
  index: number;
  state: SatodimeVaultState;
  slip44: number;
  network: SatodimeNetwork;
  /** 65-byte uncompressed public key, hex without 0x (sealed/unsealed vaults only) */
  pubkey?: string;
  /** EIP-55 address (supported EVM vaults only) */
  address?: string;
}

export interface ScannedSatodime {
  /** Compressed authentikey, hex without 0x */
  authentikey: string;
  version: CardVersion;
  versionLabel: string;
  /** Protocol >= 0.2 (on-card hash signing) */
  supportsHashSigning: boolean;
  setupDone: boolean;
  fixedUnlockSecret: boolean;
  ownership: SatodimeOwnership;
  label: string;
  isAuthentic: boolean;
  authenticityMsg: string;
  /** Empty if the card version is not supported. */
  vaults: ScannedVault[];
}

interface CardStatusError {
  statusWord?: number;
}

function statusWordOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null ? (error as CardStatusError).statusWord : undefined;
}

function toHex(b: Buffer): string {
  return Buffer.from(b).toString('hex');
}

/** EIP-55 address of an uncompressed secp256k1 public key (hex, with or without 0x). */
export function satodimeAddressFromPubkey(pubkeyHex: string): string {
  const hex = pubkeyHex.startsWith('0x') ? pubkeyHex : `0x${pubkeyHex}`;
  return ethers.utils.computeAddress(hex);
}

async function readAuthentikey(card: SatodimeCard): Promise<string> {
  const authentikey = await card.getAuthentikey();
  return toHex(authentikey.getPublicKeyBytes(true));
}

/** Prove ownership with a stored secret (protocol >= 0.2). */
async function checkStoredOwnership(card: SatodimeCard, authentikey: string): Promise<boolean> {
  const secret = await SecretStore.getSatodimeUnlockSecret(authentikey);
  if (!secret) {
    return false;
  }
  card.setUnlockSecret(secret);
  const ok = await card.checkUnlockCode();
  if (!ok) {
    // the card changed owner since: the stored secret is useless
    await SecretStore.deleteSatodimeUnlockSecret(authentikey);
    card.setUnlockSecret(null);
  }
  return ok;
}

/** Read everything needed to add accounts from a Satodime card. */
export async function scanSatodime(card: SatodimeCard): Promise<ScannedSatodime> {
  const status = await card.getStatus();
  const supportsHashSigning = card.supportsHashSigning(status);
  const authentikey = await readAuthentikey(card);

  let isAuthentic = false;
  let authenticityMsg = '';
  try {
    // same checks as for Satochip: certificate chain, then challenge-response
    const certificate = await card.verifyCertificateChain();
    if (certificate.isValid) {
      const challenge = await card.cardChallengeResponsePki();
      isAuthentic = challenge.success;
      authenticityMsg = challenge.success ? 'Card is authentic' : challenge.error;
    } else {
      authenticityMsg = certificate.txtError;
    }
  } catch (e) {
    authenticityMsg = `Authenticity check failed: ${(e as Error).message}`;
  }

  let label = '';
  try {
    label = await card.getLabel();
  } catch {
    label = '';
  }

  const satodimeStatus = await card.getSatodimeStatus();
  const fixedUnlockSecret = satodimeStatus.fixedUnlockSecret === true;

  let ownership: SatodimeOwnership;
  if (!status.setupDone) {
    ownership = 'unclaimed';
  } else if (supportsHashSigning && (await checkStoredOwnership(card, authentikey))) {
    ownership = 'owner';
  } else if (fixedUnlockSecret) {
    ownership = 'cvc-required';
  } else {
    ownership = 'owned-elsewhere';
  }

  const vaults: ScannedVault[] = [];
  if (supportsHashSigning) {
    for (let index = 0; index < satodimeStatus.nbKeyslots; index++) {
      const keyslot = await card.getKeyslotStatus(index);
      const state = keyslot.state as number as SatodimeVaultState;
      const network = decodeSatodimeSlip44(keyslot.slip44);
      const vault: ScannedVault = { index, state, slip44: keyslot.slip44, network };
      if (state !== SatodimeVaultState.UNINITIALIZED) {
        const pubkey = toHex(await card.getPubkey(index));
        vault.pubkey = pubkey;
        if (network.supported) {
          vault.address = satodimeAddressFromPubkey(pubkey);
        }
      }
      vaults.push(vault);
    }
  }

  return {
    authentikey,
    version: status.version,
    versionLabel: formatCardVersion(status.version),
    supportsHashSigning,
    setupDone: status.setupDone,
    fixedUnlockSecret,
    ownership,
    label,
    isAuthentic,
    authenticityMsg,
    vaults,
  };
}

async function requireSameCard(card: SatodimeCard, expectedAuthentikey: string): Promise<void> {
  const authentikey = await readAuthentikey(card);
  if (authentikey.toLowerCase() !== expectedAuthentikey.toLowerCase()) {
    throw new Error('Wrong card: please tap the same Satodime card that was scanned.');
  }
}

/** Take ownership of an unclaimed card and store its unlock secret securely. */
export async function claimSatodime(card: SatodimeCard, expectedAuthentikey: string): Promise<void> {
  await requireSameCard(card, expectedAuthentikey);
  const status = await card.getStatus();
  if (status.setupDone) {
    throw new Error('This card already has an owner.');
  }
  const ownership = await card.claimOwnership();
  await SecretStore.setSatodimeUnlockSecret(expectedAuthentikey, ownership.unlockSecret);
}

/** Check the CVC engraved on the card and store it as the unlock secret. */
export async function registerSatodimeCvc(card: SatodimeCard, expectedAuthentikey: string, cvc: string): Promise<void> {
  await requireSameCard(card, expectedAuthentikey);
  let secret: Buffer;
  try {
    secret = cvcToUnlockSecret(cvc);
  } catch {
    throw new Error('Invalid code format.');
  }
  card.setUnlockSecret(secret);
  const ok = await card.checkUnlockCode();
  if (!ok) {
    card.setUnlockSecret(null);
    throw new Error('Incorrect card code. Check the code printed on the card.');
  }
  await SecretStore.setSatodimeUnlockSecret(expectedAuthentikey, secret);
}

/**
 * Sign a 32-byte digest with the account's vault, after checking that:
 *  1. the card supports hash signing (protocol >= 0.2),
 *  2. the card authentikey matches the account (right card),
 *  3. the vault is unsealed,
 *  4. the vault public key matches the account,
 *  5. this device holds the card unlock secret.
 * Returns the DER signature from the card.
 */
export async function signDigestWithSatodime(
  card: SatodimeCard,
  info: SatodimeInfo,
  digest: Buffer,
): Promise<Buffer> {
  const status = await card.getStatus();
  if (!card.supportsHashSigning(status)) {
    throw new Error(`This Satodime (${formatCardVersion(status.version)}) does not support signing. Version v0.2-0.1 or later is required.`);
  }

  const authentikey = await readAuthentikey(card);
  if (authentikey.toLowerCase() !== info.authentikey.toLowerCase()) {
    throw new Error('Wrong card: the card authentikey does not match this account. Tap the Satodime card that holds this vault.');
  }

  const keyslot = await card.getKeyslotStatus(info.vaultIndex);
  const vaultState = keyslot.state as number as SatodimeVaultState;
  if (vaultState === SatodimeVaultState.SEALED) {
    throw new Error(`Vault #${info.vaultIndex + 1} is sealed: this account is watch-only. Unseal the vault in the Satodime app to spend from it.`);
  }
  if (vaultState !== SatodimeVaultState.UNSEALED) {
    throw new Error(`Vault #${info.vaultIndex + 1} is empty: it was reset since this account was added.`);
  }

  const pubkey = toHex(await card.getPubkey(info.vaultIndex));
  if (pubkey.toLowerCase() !== info.pubkey.toLowerCase()) {
    throw new Error(`Vault #${info.vaultIndex + 1} holds a different key than this account (the vault was reset and sealed again).`);
  }

  const secret = await SecretStore.getSatodimeUnlockSecret(info.authentikey);
  if (!secret) {
    throw new Error('This device is not the owner of this Satodime card. Add the account again to claim ownership or enter the card code.');
  }
  card.setUnlockSecret(secret);

  try {
    return await card.signTransactionHash(info.vaultIndex, digest);
  } catch (error) {
    const sw = statusWordOf(error);
    if (sw === SW_INCORRECT_UNLOCK_CODE || sw === SW_INCORRECT_UNLOCK_COUNTER) {
      await SecretStore.deleteSatodimeUnlockSecret(info.authentikey);
      throw new Error('This device is no longer the owner of this Satodime card (ownership was transferred).');
    }
    if (sw === SW_INCORRECT_KEYSLOT_STATE) {
      throw new Error(`Vault #${info.vaultIndex + 1} cannot sign in its current state.`);
    }
    throw error;
  } finally {
    card.setUnlockSecret(null);
  }
}

/**
 * Re-read the state of an account's vault (e.g. after it was unsealed in the
 * Satodime app), checking that the card and the vault key still match.
 */
export async function readSatodimeVaultState(card: SatodimeCard, info: SatodimeInfo): Promise<SatodimeVaultState> {
  const authentikey = await readAuthentikey(card);
  if (authentikey.toLowerCase() !== info.authentikey.toLowerCase()) {
    throw new Error('Wrong card: the card authentikey does not match this account.');
  }
  const keyslot = await card.getKeyslotStatus(info.vaultIndex);
  const state = keyslot.state as number as SatodimeVaultState;
  if (state !== SatodimeVaultState.UNINITIALIZED) {
    const pubkey = toHex(await card.getPubkey(info.vaultIndex));
    if (pubkey.toLowerCase() !== info.pubkey.toLowerCase()) {
      throw new Error(`Vault #${info.vaultIndex + 1} holds a different key than this account.`);
    }
  }
  return state;
}
