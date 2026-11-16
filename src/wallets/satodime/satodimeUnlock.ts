/**
 * Get what a Satodime signature needs from the user, on demand: permission to
 * unseal a sealed vault, permission to claim an ownerless card, or the code
 * engraved on a CVC card.
 *
 * Prompts can't be shown in the middle of an NFC session, so:
 *  1. before the tap, the stored card state predicts what is needed and the
 *     user is asked;
 *  2. if the card disagrees (stale state), the NFC attempt raises
 *     SatodimeUnlockRequired with what is missing, the user is asked, and the
 *     signature is retried once (second tap).
 *
 * UI-agnostic: the prompts are injected (see components/SatodimeUnlockPrompts.tsx).
 */
import { SatodimeInfo, SatodimeVaultState } from '@/types/WalletTypes';
import { SecretStore } from '@/utils/SecretStore';
import { SatodimeNeeds, SatodimeSignOptions, SatodimeUnlockRequired, hasNeeds } from './SatodimeClient';

export interface SatodimeUnlockPrompts {
  /** Ask for the code engraved on the card; null if the user cancels. */
  requestCvc(info: SatodimeInfo): Promise<string | null>;
  /** Ask permission to claim an ownerless card; false if the user refuses. */
  confirmClaim(info: SatodimeInfo): Promise<boolean>;
  /** Ask permission to unseal the vault (and claim the card first if `claim`). */
  confirmUnseal(info: SatodimeInfo, details: { claim: boolean }): Promise<boolean>;
  /** Explain that the sealed vault can't be unsealed: the card is owned by another app. */
  informOwnershipRequired(info: SatodimeInfo): Promise<void>;
}

export class SatodimeSigningCancelled extends Error {
  constructor(message = 'Signing cancelled: the card code or ownership is needed to sign.') {
    super(message);
    this.name = 'SatodimeSigningCancelled';
  }
}

/** What the stored card state says this signature will need (before any tap). */
export function predictNeeds(info: SatodimeInfo, hasStoredCode: boolean): SatodimeNeeds {
  return {
    unseal: info.vaultState === SatodimeVaultState.SEALED,
    claim: !hasStoredCode && info.cardHasOwner === false,
    cvc: !hasStoredCode && info.fixedUnlockSecret === true && info.cardHasOwner !== false,
  };
}

/** Sealed vault of a non-CVC card owned by another app: this phone can't unseal it. */
function cannotUnseal(info: SatodimeInfo, hasStoredCode: boolean): boolean {
  return (
    info.vaultState === SatodimeVaultState.SEALED &&
    !hasStoredCode &&
    info.fixedUnlockSecret === false &&
    info.cardHasOwner === true
  );
}

/** Ask the user for everything in `needs`, in one sequence. */
async function askFor(
  needs: SatodimeNeeds,
  info: SatodimeInfo,
  prompts: SatodimeUnlockPrompts,
): Promise<SatodimeSignOptions> {
  const options: SatodimeSignOptions = {};
  if (needs.unseal) {
    // one popup covers unsealing, and claiming the card when it has no owner
    if (!(await prompts.confirmUnseal(info, { claim: !!needs.claim }))) {
      throw new SatodimeSigningCancelled();
    }
    options.allowUnseal = true;
    if (needs.claim) {
      options.allowClaim = true;
    }
  } else if (needs.claim) {
    if (!(await prompts.confirmClaim(info))) {
      throw new SatodimeSigningCancelled();
    }
    options.allowClaim = true;
  }
  if (needs.cvc) {
    const cvc = await prompts.requestCvc(info);
    if (!cvc) {
      throw new SatodimeSigningCancelled();
    }
    options.cvc = cvc;
  }
  return options;
}

/**
 * Run a Satodime NFC signing attempt, asking the user first when needed.
 * `attempt` must open its own NFC session.
 */
export async function signWithSatodimeUnlock<T>(
  info: SatodimeInfo,
  attempt: (options: SatodimeSignOptions) => Promise<T>,
  prompts: SatodimeUnlockPrompts,
): Promise<T> {
  // 1. Ask before the tap, from the stored card state
  const hasStoredCode = await SecretStore.hasSatodimeUnlockSecret(info.authentikey);
  if (cannotUnseal(info, hasStoredCode)) {
    await prompts.informOwnershipRequired(info);
    throw new SatodimeSigningCancelled('Signing cancelled: the card ownership is required to unseal this vault.');
  }
  const predicted = predictNeeds(info, hasStoredCode);
  const options = hasNeeds(predicted) ? await askFor(predicted, info, prompts) : {};

  // 2. Sign; if the stored state was stale, ask for what is missing and retry once
  try {
    return await attempt(options);
  } catch (error) {
    if (!(error instanceof SatodimeUnlockRequired)) {
      throw error;
    }
    const extra = await askFor(error.needs, info, prompts);
    return attempt({ ...options, ...extra });
  }
}
