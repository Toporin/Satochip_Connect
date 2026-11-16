/**
 * App-wide Satodime unlock prompts, implemented by the
 * <SatodimeUnlockPrompts /> host mounted once in the root navigator.
 */
import type { SatodimeInfo } from '@/types/WalletTypes';
import type { SatodimeUnlockPrompts } from './satodimeUnlock';

let host: SatodimeUnlockPrompts | null = null;

/** Called by the host component on mount / unmount. */
export function registerSatodimePromptHost(impl: SatodimeUnlockPrompts | null): void {
  host = impl;
}

export const satodimePrompts: SatodimeUnlockPrompts = {
  requestCvc(info: SatodimeInfo) {
    if (!host) {
      return Promise.reject(new Error('Satodime prompts are not available'));
    }
    return host.requestCvc(info);
  },
  confirmClaim(info: SatodimeInfo) {
    if (!host) {
      return Promise.reject(new Error('Satodime prompts are not available'));
    }
    return host.confirmClaim(info);
  },
};
