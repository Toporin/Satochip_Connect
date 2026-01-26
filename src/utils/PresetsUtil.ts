import {ImageSourcePropType} from 'react-native';
import { EIP155_CHAINS, EIP155_NETWORK_IMAGES } from '@/constants/Eip155';
import Unknown from '@/assets/chains/unknown.png';

const NetworkImages: Record<string, ImageSourcePropType> = {
  ...EIP155_NETWORK_IMAGES,
};


export const ALL_CHAINS = {
  ...EIP155_CHAINS,
};

export const PresetsUtil = {
  getChainLogo: (chainId: string | number) => {
    const logo = NetworkImages[chainId];
    if (!logo) {
      return Unknown;
    }
    return logo;
  },
  getChainData: (chainId?: string) => {
    if (!chainId) return
    const [namespace, reference] = chainId.toString().split(':')
    return Object.values(ALL_CHAINS).find(
      chain => chain.chainId === reference && chain.namespace === namespace
    )
  }
};
