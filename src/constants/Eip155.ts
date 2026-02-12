import Ethereum from '@/assets/chains/ethereum.webp';
import Arbitrum from '@/assets/chains/arbitrum.webp';
import Avalanche from '@/assets/chains/avalanche.webp';
import Binance from '@/assets/chains/binance.webp';
import Fantom from '@/assets/chains/fantom.webp';
import Optimism from '@/assets/chains/optimism.webp';
import Polygon from '@/assets/chains/polygon.webp';
import Gnosis from '@/assets/chains/gnosis.webp';
import Evmos from '@/assets/chains/evmos.webp';
import ZkSync from '@/assets/chains/zksync.webp';
import Filecoin from '@/assets/chains/filecoin.webp';
import Iotx from '@/assets/chains/iotx.webp';
import Metis from '@/assets/chains/metis.webp';
import Moonbeam from '@/assets/chains/moonbeam.webp';
import Moonriver from '@/assets/chains/moonriver.webp';
import Zora from '@/assets/chains/zora.webp';
import Celo from '@/assets/chains/celo.webp';
import Base from '@/assets/chains/base.webp';
import Aurora from '@/assets/chains/aurora.webp';
import Unknown from '@/assets/chains/unknown.png';
import { Chain } from '@/utils/TypesUtil';
import { ImageSourcePropType } from 'react-native';


// Helpers
export const EIP155_CHAINS: Record<string, Chain> = {
  'eip155:1': {
    chainId: '1',
    namespace: 'eip155',
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
  },
  'eip155:5': {
    chainId: '5',
    namespace: 'eip155',
    name: 'Ethereum Goerli',
    symbol: 'ETH',
    rpcUrl: 'https://rpc.ankr.com/eth_goerli',
  },
  'eip155:11155111': {
    chainId: '11155111',
    namespace: 'eip155',
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://0xrpc.io/sep',
  },
  'eip155:42161': {
    chainId: '42161',
    namespace: 'eip155',
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
  },
  'eip155:43114': {
    chainId: '43114',
    namespace: 'eip155',
    name: 'Avalanche',
    symbol: 'AVAX',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  },
  'eip155:43113': {
    chainId: '43113',
    namespace: 'eip155',
    name: 'Avalanche Fuji',
    symbol: 'AVAX',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  },
  'eip155:56': {
    chainId: '56',
    namespace: 'eip155',
    name: 'Binance Smart Chain',
    symbol: 'BNB',
    rpcUrl: 'https://rpc.ankr.com/bsc',
  },
  'eip155:97': {
    chainId: '97',
    namespace: 'eip155',
    name: 'Binance Smart Chain Testnet',
    symbol: 'BNB',
    rpcUrl: 'https://api.zan.top/bsc-testnet',
  },
  'eip155:250': {
    chainId: '250',
    namespace: 'eip155',
    name: 'Fantom',
    symbol: 'FTM',
    rpcUrl: 'https://rpc.ankr.com/fantom',
  },
  'eip155:10': {
    chainId: '10',
    namespace: 'eip155',
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.optimism.io',
  },
  'eip155:11155420': {
    chainId: '11155420',
    namespace: 'eip155',
    name: 'Optimism Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://sepolia.optimism.io',
  },
  'eip155:137': {
    chainId: '137',
    namespace: 'eip155',
    name: 'Polygon',
    symbol: 'POL',
    rpcUrl: 'https://polygon-rpc.com',
  },
  'eip155:80002': {
    chainId: '80002',
    namespace: 'eip155',
    name: 'Polygon Amoy',
    symbol: 'POL',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
  },
  'eip155:100': {
    chainId: '100',
    namespace: 'eip155',
    name: 'Gnosis',
    symbol: 'xDAI',
    rpcUrl: 'https://rpc.gnosischain.com',
  },
  'eip155:9001': {
    chainId: '9001',
    namespace: 'eip155',
    name: 'Evmos',
    symbol: 'EVMOS',
    rpcUrl: 'https://eth.bd.evmos.org:8545',
  },
  'eip155:324': {
    chainId: '324',
    namespace: 'eip155',
    name: 'zkSync Era',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.era.zksync.io',
  },
  'eip155:314': {
    chainId: '314',
    namespace: 'eip155',
    name: 'Filecoin Mainnet',
    symbol: 'FIL',
    rpcUrl: 'https://api.node.glif.io/rpc/v1',
  },
  'eip155:4689': {
    chainId: '4689',
    namespace: 'eip155',
    name: 'IoTeX',
    symbol: 'IOTX',
    rpcUrl: 'https://babel-api.mainnet.iotex.io',
  },
  'eip155:1088': {
    chainId: '1088',
    namespace: 'eip155',
    name: 'Metis',
    symbol: 'METIS',
    rpcUrl: 'https://andromeda.metis.io/?owner=1088',
  },
  'eip155:1284': {
    chainId: '1284',
    namespace: 'eip155',
    name: 'Moonbeam',
    symbol: 'GLMR',
    rpcUrl: 'https://moonbeam.public.blastapi.io',
  },
  'eip155:1285': {
    chainId: '1285',
    namespace: 'eip155',
    name: 'Moonriver',
    symbol: 'MOVR',
    rpcUrl: 'https://moonriver.public.blastapi.io',
  },
  'eip155:7777777': {
    chainId: '7777777',
    namespace: 'eip155',
    name: 'Zora',
    symbol: 'ETH',
    rpcUrl: 'https://rpc.zora.energy',
  },
  'eip155:42220': {
    chainId: '42220',
    namespace: 'eip155',
    name: 'Celo',
    symbol: 'CELO',
    rpcUrl: 'https://forno.celo.org',
  },
  'eip155:8453': {
    chainId: '8453',
    namespace: 'eip155',
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
  },
  'eip155:1313161554': {
    chainId: '1313161554',
    namespace: 'eip155',
    name: 'Aurora',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.aurora.dev',
  },
};

export const EIP155_NETWORK_IMAGES: Record<string, ImageSourcePropType> = {
  'eip155:1': Ethereum,
  'eip155:5': Unknown,
  'eip155:11155111': Unknown,
  'eip155:42161': Arbitrum,
  'eip155:43114': Avalanche,
  'eip155:43113': Avalanche,
  'eip155:56': Binance,
  'eip155:97': Unknown,
  'eip155:250': Fantom,
  'eip155:10': Optimism,
  'eip155:11155420': Optimism,
  'eip155:137': Polygon,
  'eip155:80002': Polygon,
  'eip155:100': Gnosis,
  'eip155:9001': Evmos,
  'eip155:324': ZkSync,
  'eip155:314': Filecoin,
  'eip155:4689': Iotx,
  'eip155:1088': Metis,
  'eip155:1284': Moonbeam,
  'eip155:1285': Moonriver,
  'eip155:7777777': Zora,
  'eip155:42220': Celo,
  'eip155:8453': Base,
  'eip155:1313161554': Aurora,
};

export const EIP155_SIGNING_METHODS = {
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN: 'eth_sign',
  ETH_SIGN_TRANSACTION: 'eth_signTransaction',
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  ETH_SEND_RAW_TRANSACTION: 'eth_sendRawTransaction',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction',
};

// todo: fetch rpcs from https://chainlist.org/rpcs.json
export const EIP155_RPCS_BY_CHAINS: { [key: number]: string[] } = {
  // Ethereum Mainnet
  1: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://1rpc.io/eth',
    'https://ethereum.publicnode.com',
    'https://cloudflare-eth.com',
  ],

  // Ethereum Sepolia Testnet
  11155111: [
    'https://0xrpc.io/sep',
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.ankr.com/eth_sepolia',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Public Infura endpoint
    'https://1rpc.io/sepolia',
  ],

  // Polygon Mainnet
  137: [
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
    'https://1rpc.io/matic',
    'https://polygon.llamarpc.com',
  ],

  // Polygon Amoy Testnet
  80002: [
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy.drpc.org',
    'https://polygon-amoy-public.nodies.app',
    'https://polygon-amoy.api.onfinality.io/public',
  ],

  // BSC Mainnet
  56: [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://rpc.ankr.com/bsc',
    'https://1rpc.io/bnb',
  ],

  // BSC Testnet
  97: [
    'https://data-seed-prebsc-1-s1.binance.org:8545',
    'https://data-seed-prebsc-2-s1.binance.org:8545',
  ],

  // Arbitrum One
  42161: [
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
    'https://1rpc.io/arb',
  ],

  // Arbitrum Sepolia
  421614: [
    'https://arbitrum-sepolia.drpc.org',
    'https://endpoints.omniatech.io/v1/arbitrum/sepolia/public',
    'https://arbitrum-sepolia-testnet.api.pocket.network',
  ],

  // Optimism Mainnet
  10: [
    'https://mainnet.optimism.io',
    'https://rpc.ankr.com/optimism',
    'https://1rpc.io/op',
  ],

  // Optimism Sepolia
  11155420: [
    'https://sepolia.optimism.io',
    'https://endpoints.omniatech.io/v1/op/sepolia/public',
    'https://optimism-sepolia.drpc.org',
    'https://optimism-sepolia.api.onfinality.io/public',
  ],

  // Avalanche C-Chain
  43114: [
    'https://api.avax.network/ext/bc/C/rpc',
    'https://rpc.ankr.com/avalanche',
    '1rpc.io/avax/c',
  ],

  // Avalanche Fuji Testnet
  43113: [
    'https://api.avax-test.network/ext/bc/C/rpc',
    'https://rpc.ankr.com/avalanche_fuji',
  ],

  // Fantom Mainnet
  250: [
    'https://rpc.fantom.network',
    'https://rpc2.fantom.network',
    'https://fantom-public.nodies.app',
    'https://fantom.drpc.org',
    'https://1rpc.io/ftm',
  ],

  // Base Mainnet
  8453: [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    '1rpc.io/base',
  ],

  // Base Sepolia
  84532: [
    'https://sepolia.base.org',
    'https://base-sepolia.drpc.org',
    'https://base-sepolia-public.nodies.app',
    'https://base-sepolia-rpc.publicnode.com',
  ],

  // Gnosis Chain (xDai)
  100: [
    'https://rpc.gnosischain.com',
    'https://rpc.ankr.com/gnosis',
  ],

  // zkSync Era Mainnet
  324: [
    'https://mainnet.era.zksync.io',
    '1rpc.io/zksync2-era',
  ],

  // Polygon zkEVM
  1101: [
    'https://zkevm-rpc.com',
    'https://rpc.ankr.com/polygon_zkevm',
    'https://1rpc.io/polygon/zkevm',
  ],

  // Celo Mainnet
  42220: [
    'https://forno.celo.org',
    'https://rpc.ankr.com/celo',
    'https://1rpc.io/celo',
  ],

  // Harmony Mainnet
  1666600000: [
    'https://api.harmony.one',
    'https://rpc.ankr.com/harmony',
    'https://1rpc.io/one',
  ],
};
