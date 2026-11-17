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
const SW_SETUP_NOT_DONE = 0x9C04;

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

/**
 * Prove ownership with the stored unlock code (protocol >= 0.2, card set up).
 *
 * checkUnlockCode() returns false for both a wrong code (9C51) and a counter
 * out of sync (9C50). The counter is re-read before each attempt, so a 9C50
 * does not repeat: a second failure means the code is wrong (the card changed
 * owner), and the stored code is deleted since it is useless.
 */
async function checkStoredOwnership(card: SatodimeCard, authentikey: string): Promise<boolean> {
  const secret = await SecretStore.getSatodimeUnlockSecret(authentikey);
  if (!secret) {
    return false;
  }
  card.setUnlockSecret(secret);
  const ok = (await card.checkUnlockCode()) || (await card.checkUnlockCode());
  if (!ok) {
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

/** Claim an ownerless card (SETUP) and store the returned unlock code (the CVC itself on CVC cards). */
async function claimAndStore(card: SatodimeCard, info: SatodimeInfo): Promise<Buffer> {
  const ownership = await card.claimOwnership();
  await SecretStore.setSatodimeUnlockSecret(info.authentikey, ownership.unlockSecret);
  return ownership.unlockSecret;
}

/** Check the code typed by the user against the card (0x54) and store it if correct. */
async function verifyAndStoreCvc(card: SatodimeCard, info: SatodimeInfo, cvc: string): Promise<Buffer> {
  let secret: Buffer;
  try {
    secret = cvcToUnlockSecret(cvc);
  } catch {
    throw new Error('Invalid card code format.');
  }
  card.setUnlockSecret(secret);
  if (!(await checkUnlockCodeTwice(card))) {
    card.setUnlockSecret(null);
    throw new Error('Incorrect card code. Check the code engraved on the card. Nothing was signed.');
  }
  await SecretStore.setSatodimeUnlockSecret(info.authentikey, secret);
  return secret;
}

/**
 * Unseal a vault (irreversible). The card returns the private key: it is never
 * kept, returned or logged, and its buffers are wiped right away.
 */
async function unsealVault(card: SatodimeCard, vaultIndex: number): Promise<void> {
  const disclosed = await card.unseal(vaultIndex);
  disclosed.privkey.fill(0);
  disclosed.userEntropy.fill(0);
  disclosed.cardEntropy.fill(0);
}

/** Non-CVC card owned by another app: this phone cannot get its unlock code. */
function ownedElsewhereMessage(sealed: boolean): string {
  const release =
    'Release its ownership from the app that owns it (Satodime on mobile or Satochip-Utils on desktop), then try again.';
  return sealed
    ? `This vault is sealed, and unsealing it requires the card ownership. The card is owned by another app. ${release}`
    : `This card is owned by another app. ${release}`;
}

/**
 * What a signature still needs from the user. Computed in one pass inside the
 * NFC session, before anything changes on the card, so the user is asked once
 * (see satodimeUnlock.ts) and the signature retried once.
 */
export interface SatodimeNeeds {
  /** permission to unseal the vault (irreversible) */
  unseal?: boolean;
  /** permission to claim the card (it has no owner) */
  claim?: boolean;
  /** the code engraved on the card (CVC card without stored code) */
  cvc?: boolean;
}

export function hasNeeds(needs: SatodimeNeeds): boolean {
  return !!(needs.unseal || needs.claim || needs.cvc);
}

/** Raised inside the NFC session when signing needs user input; the caller asks and retries. */
export class SatodimeUnlockRequired extends Error {
  readonly needs: SatodimeNeeds;
  constructor(needs: SatodimeNeeds) {
    super('User input is required to sign with this Satodime vault.');
    this.name = 'SatodimeUnlockRequired';
    this.needs = needs;
  }
}

/** Card state observed during a scan, to update stored accounts opportunistically. */
export interface SatodimeObservedState {
  /** CVC card: the unlock code is engraved and fixed */
  fixedUnlockSecret: boolean;
  /** card set up (has an owner) */
  cardHasOwner: boolean;
  /** state of the account's vault */
  vaultState: SatodimeVaultState;
}

export interface SatodimeSignOptions {
  /** CVC typed by the user (CVC cards without a stored code) */
  cvc?: string;
  /** the user agreed to claim the card if it has no owner */
  allowClaim?: boolean;
  /** the user agreed to unseal the vault if it is sealed */
  allowUnseal?: boolean;
  /** called with the card state read during the session */
  onCardState?: (state: SatodimeObservedState) => void;
}

/** checkUnlockCode() is false for 9C50 and 9C51: retry once to rule out a counter desync. */
async function checkUnlockCodeTwice(card: SatodimeCard): Promise<boolean> {
  return (await card.checkUnlockCode()) || (await card.checkUnlockCode());
}

/**
 * Sign a 32-byte digest with the account's vault (one NFC session):
 *  1. check the card version, the card (authentikey) and the vault key;
 *  2. compute what is missing from the user (unseal / claim / CVC permission
 *     or code) and throw SatodimeUnlockRequired before changing anything;
 *  3. get the unlock code: stored, claimed (ownerless card) or typed CVC;
 *  4. unseal the vault if it is sealed (with the user's permission);
 *  5. sign. Returns the DER signature from the card.
 */
export async function signDigestWithSatodime(
  card: SatodimeCard,
  info: SatodimeInfo,
  digest: Buffer,
  options: SatodimeSignOptions = {},
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
  if (vaultState === SatodimeVaultState.UNINITIALIZED) {
    throw new Error(`Vault #${info.vaultIndex + 1} is empty: it was reset since this account was added.`);
  }

  const pubkey = toHex(await card.getPubkey(info.vaultIndex));
  if (pubkey.toLowerCase() !== info.pubkey.toLowerCase()) {
    throw new Error(`Vault #${info.vaultIndex + 1} holds a different key than this account (the vault was reset and sealed again).`);
  }

  // Card state (also reported for opportunistic updates of stored accounts)
  const sealed = vaultState === SatodimeVaultState.SEALED;
  const isCvcCard = (await card.getSatodimeStatus()).fixedUnlockSecret === true;
  const report = (state: Partial<SatodimeObservedState>) =>
    options.onCardState?.({ fixedUnlockSecret: isCvcCard, cardHasOwner: status.setupDone, vaultState, ...state });
  report({});

  // What is still missing from the user, before anything changes on the card
  const storedSecret = await SecretStore.getSatodimeUnlockSecret(info.authentikey);
  const needs: SatodimeNeeds = {
    unseal: sealed && !options.allowUnseal,
    claim: !status.setupDone && !options.allowClaim,
    cvc: status.setupDone && isCvcCard && !storedSecret && !options.cvc,
  };
  if (hasNeeds(needs)) {
    throw new SatodimeUnlockRequired(needs);
  }
  if (status.setupDone && !isCvcCard && !storedSecret) {
    throw new Error(ownedElsewhereMessage(sealed));
  }

  // Unlock code: stored, claimed (ownerless card) or typed CVC
  let secret: Buffer;
  if (!status.setupDone) {
    secret = await claimAndStore(card, info);
    report({ cardHasOwner: true });
  } else {
    secret = storedSecret ?? (await verifyAndStoreCvc(card, info, options.cvc!));
  }
  card.setUnlockSecret(secret);

  try {
    if (sealed) {
      await unsealVault(card, info.vaultIndex);
      report({ cardHasOwner: true, vaultState: SatodimeVaultState.UNSEALED });
    }
    return await card.signTransactionHash(info.vaultIndex, digest);
  } catch (error) {
    const sw = statusWordOf(error);
    if (sw === SW_INCORRECT_UNLOCK_CODE) {
      // wrong unlock code: the stored code is useless
      await SecretStore.deleteSatodimeUnlockSecret(info.authentikey);
      throw new Error(
        isCvcCard
          ? 'The stored card code is wrong and was removed. Sign again to enter the code engraved on the card.'
          : 'This device is not (or no longer) the owner of this Satodime card.',
      );
    }
    if (sw === SW_INCORRECT_UNLOCK_COUNTER) {
      // transient: keep the stored code
      throw new Error('Unlock counter out of sync, please try again.');
    }
    if (sw === SW_SETUP_NOT_DONE) {
      throw new Error('This card has no owner (ownership was released). Add the account again to claim it.');
    }
    if (sw === SW_INCORRECT_KEYSLOT_STATE) {
      throw new Error(`Vault #${info.vaultIndex + 1} cannot sign in its current state.`);
    }
    throw error;
  } finally {
    card.setUnlockSecret(null);
  }
}

export interface SatodimeCardState {
  vaultState: SatodimeVaultState;
  /** false when ownership was released (card has no owner) */
  setupDone: boolean;
  /** CVC card: the unlock code is engraved on the card and never changes */
  fixedUnlockSecret: boolean;
  /** this phone holds a valid unlock code for the card */
  ownedByThisPhone: boolean;
}

/**
 * Re-read the state of an account's card and vault (e.g. after it changed in
 * another app), checking that the card and the vault key
 * still match. Ownership is checked with the stored unlock code (0x54).
 */
export async function readSatodimeCardState(card: SatodimeCard, info: SatodimeInfo): Promise<SatodimeCardState> {
  const status = await card.getStatus();
  const authentikey = await readAuthentikey(card);
  if (authentikey.toLowerCase() !== info.authentikey.toLowerCase()) {
    throw new Error('Wrong card: the card authentikey does not match this account.');
  }
  const keyslot = await card.getKeyslotStatus(info.vaultIndex);
  const vaultState = keyslot.state as number as SatodimeVaultState;
  if (vaultState !== SatodimeVaultState.UNINITIALIZED) {
    const pubkey = toHex(await card.getPubkey(info.vaultIndex));
    if (pubkey.toLowerCase() !== info.pubkey.toLowerCase()) {
      throw new Error(`Vault #${info.vaultIndex + 1} holds a different key than this account.`);
    }
  }
  const satodimeStatus = await card.getSatodimeStatus();
  const fixedUnlockSecret = satodimeStatus.fixedUnlockSecret === true;
  const ownedByThisPhone =
    status.setupDone && card.supportsHashSigning(status) && (await checkStoredOwnership(card, info.authentikey));
  card.setUnlockSecret(null);
  return { vaultState, setupDone: status.setupDone, fixedUnlockSecret, ownedByThisPhone };
}

/**
 * Release ownership of a non-CVC card owned by this phone (0x5A). Anyone can
 * then claim the card, which creates a new unlock code: the stored code is
 * deleted. Not offered for CVC cards (their code is engraved and never changes).
 */
export async function releaseSatodimeOwnership(card: SatodimeCard, info: SatodimeInfo): Promise<void> {
  const status = await card.getStatus();
  if (!card.supportsHashSigning(status)) {
    throw new Error(`This Satodime (${formatCardVersion(status.version)}) is not supported.`);
  }
  await requireSameCard(card, info.authentikey);
  if (!status.setupDone) {
    throw new Error('This card has no owner: there is nothing to release.');
  }
  const satodimeStatus = await card.getSatodimeStatus();
  if (satodimeStatus.fixedUnlockSecret === true) {
    throw new Error('This card has an engraved code: releasing ownership is not needed.');
  }
  if (!(await checkStoredOwnership(card, info.authentikey))) {
    throw new Error('This device is not the owner of this Satodime card.');
  }
  try {
    await card.transferOwnership();
  } finally {
    card.setUnlockSecret(null);
  }
  await SecretStore.deleteSatodimeUnlockSecret(info.authentikey);
}
