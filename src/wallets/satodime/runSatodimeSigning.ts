/**
 * Run a Satodime signature from the UI: unlock code on demand (prompt + retry,
 * see satodimeUnlock.ts), one NFC session per attempt (closed before any
 * prompt, so the iOS NFC sheet is not left open), and opportunistic update of
 * the stored card state from what the card reports.
 */
import type { SatodimeCard } from 'satochip-react-native';

import SettingsStore from '@/store/SettingsStore';
import type { SatodimeInfo } from '@/types/WalletTypes';
import type { SatodimeSignOptions } from './SatodimeClient';
import { signWithSatodimeUnlock } from './satodimeUnlock';
import { satodimePrompts } from './satodimePrompts';

type WithModal = (callback: () => Promise<unknown>) => (() => Promise<unknown>) | undefined;

export async function runSatodimeSigning<T>(
  info: SatodimeInfo,
  card: SatodimeCard,
  withModal: WithModal,
  closeNfc: () => void,
  sign: (options: SatodimeSignOptions) => Promise<T>,
): Promise<T> {
  const onCardState: SatodimeSignOptions['onCardState'] = state =>
    SettingsStore.updateSatodimeCardState(info.authentikey, {
      fixedUnlockSecret: state.fixedUnlockSecret,
      cardHasOwner: state.cardHasOwner,
      vaultStates: { [info.vaultIndex]: state.vaultState },
    });

  return signWithSatodimeUnlock(
    info,
    async options => {
      try {
        const run = withModal(() => sign({ ...options, onCardState }));
        if (!run) {
          throw new Error('NFC is not supported on this platform');
        }
        return (await run()) as T;
      } finally {
        closeNfc();
        await card.endNfcSession().catch(() => undefined);
      }
    },
    satodimePrompts,
  );
}
