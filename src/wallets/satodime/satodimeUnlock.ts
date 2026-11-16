/**
 * Obtain the Satodime unlock code on demand when signing.
 *
 * Prompts can't be shown in the middle of an NFC session, so:
 *  1. before the tap, the stored card state decides what to ask
 *     (CVC card without stored code -> CVC; ownerless non-CVC card -> claim);
 *  2. if the card disagrees (stale state), the NFC attempt raises
 *     SatodimeUnlockRequired, the user is asked, and the signature is retried
 *     once (second tap).
 *
 * UI-agnostic: the prompts are injected (see components/SatodimeUnlockPrompts.tsx).
 */
import type { SatodimeInfo } from '@/types/WalletTypes';
import { SecretStore } from '@/utils/SecretStore';
import { SatodimeSignOptions, SatodimeUnlockKind, SatodimeUnlockRequired } from './SatodimeClient';

export interface SatodimeUnlockPrompts {
  /** Ask for the code engraved on the card; null if the user cancels. */
  requestCvc(info: SatodimeInfo): Promise<string | null>;
  /** Ask permission to claim an ownerless card; false if the user refuses. */
  confirmClaim(info: SatodimeInfo): Promise<boolean>;
}

export class SatodimeSigningCancelled extends Error {
  constructor() {
    super('Signing cancelled: the card code or ownership is needed to sign.');
    this.name = 'SatodimeSigningCancelled';
  }
}

async function ask(
  kind: SatodimeUnlockKind,
  info: SatodimeInfo,
  prompts: SatodimeUnlockPrompts,
): Promise<SatodimeSignOptions> {
  if (kind === 'cvc') {
    const cvc = await prompts.requestCvc(info);
    if (!cvc) {
      throw new SatodimeSigningCancelled();
    }
    return { cvc };
  }
  if (!(await prompts.confirmClaim(info))) {
    throw new SatodimeSigningCancelled();
  }
  return { allowClaim: true };
}

/**
 * Run a Satodime NFC signing attempt, asking for the unlock code (or claim
 * permission) when needed. `attempt` must open its own NFC session.
 */
export async function signWithSatodimeUnlock<T>(
  info: SatodimeInfo,
  attempt: (options: SatodimeSignOptions) => Promise<T>,
  prompts: SatodimeUnlockPrompts,
): Promise<T> {
  let options: SatodimeSignOptions = {};

  // 1. Ask before the tap when the stored state already tells what is missing
  const hasCode = await SecretStore.hasSatodimeUnlockSecret(info.authentikey);
  if (!hasCode) {
    if (info.cardHasOwner === false) {
      options = await ask('claim', info, prompts);
    } else if (info.fixedUnlockSecret === true) {
      options = await ask('cvc', info, prompts);
    }
  }

  // 2. Sign; if the card state was stale, ask and retry once
  try {
    return await attempt(options);
  } catch (error) {
    if (!(error instanceof SatodimeUnlockRequired)) {
      throw error;
    }
    const extra = await ask(error.kind, info, prompts);
    return attempt({ ...options, ...extra });
  }
}
