/**
 * App-wide Satodime unlock prompts, implemented by the
 * <SatodimeUnlockPrompts /> host mounted once in the root navigator.
 */
import type { SatodimeUnlockPrompts } from './satodimeUnlock';

let host: SatodimeUnlockPrompts | null = null;

/** Called by the host component on mount / unmount. */
export function registerSatodimePromptHost(impl: SatodimeUnlockPrompts | null): void {
  host = impl;
}

function requireHost(): SatodimeUnlockPrompts {
  if (!host) {
    throw new Error('Satodime prompts are not available');
  }
  return host;
}

export const satodimePrompts: SatodimeUnlockPrompts = {
  requestCvc: async info => requireHost().requestCvc(info),
  confirmClaim: async info => requireHost().confirmClaim(info),
  confirmUnseal: async (info, details) => requireHost().confirmUnseal(info, details),
  informOwnershipRequired: async info => requireHost().informOwnershipRequired(info),
};
