import { useMemo, useState } from 'react';
import { SatochipCard, SatodimeCard } from 'satochip-react-native';

import SettingsStore from '@/store/SettingsStore';
import { IWalletProvider, WalletType } from '@/types/WalletTypes';
import useSatochipModal from '@/hooks/useSatochipModal';

/**
 * Account that signs a WalletConnect request for `address`, plus the NFC card
 * matching its type.
 *
 * Several accounts can share an address (e.g. a software account restored from
 * the seed of a Satochip card). In that case no account is picked until the
 * user chooses one: `needsChoice` is true and `wallet` is undefined.
 */
export default function useRequestWallet(address?: string) {
  const candidates = useMemo<IWalletProvider[]>(
    () => (address ? SettingsStore.getWalletsByAddress(address) : []),
    [address],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const wallet =
    candidates.length === 1
      ? candidates[0]
      : candidates.find(w => w.id === selectedId);
  const needsChoice = candidates.length > 1 && !wallet;

  // One card object per type, so switching accounts uses the right protocol
  const [satochipCard] = useState(() => new SatochipCard());
  const [satodimeCard] = useState(() => new SatodimeCard());
  const card = wallet?.type === WalletType.SATODIME ? satodimeCard : satochipCard;
  const { withModal, nfcVisible, closeNfc } = useSatochipModal(card);

  return {
    candidates,
    wallet,
    needsChoice,
    selectWallet: setSelectedId,
    card,
    withModal,
    nfcVisible,
    closeNfc,
  };
}
