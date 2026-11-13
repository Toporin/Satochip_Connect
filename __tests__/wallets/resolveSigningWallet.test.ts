/**
 * Several accounts can share an address (software account restored from a
 * Satochip seed). The request handler must sign with the account the caller
 * chose, and never guess between accounts of different types.
 */
const mockWallets: any[] = [];

jest.mock('@/store/SettingsStore.ts', () => ({
  __esModule: true,
  default: {
    getWalletsByAddress: (address: string) =>
      mockWallets.filter(w => w.address.toLowerCase() === address.toLowerCase()),
  },
}));
jest.mock('satochip-react-native', () => ({}));
jest.mock('@/wallets/satochip/SatochipWallet.ts', () => ({}));
jest.mock('@/wallets/satodime/SatodimeWallet', () => ({}));
jest.mock('@/wallets/EIP155SoftwareWallet.ts', () => ({}));
jest.mock('@/utils/HelperUtil', () => ({}));
jest.mock('@/utils/EIP155Utils', () => ({}));
jest.mock('@/constants/Eip155', () => ({ EIP155_SIGNING_METHODS: {} }));

import { resolveSigningWallet } from '@/utils/EnhancedEIP155RequestHandler';
import { WalletError, WalletErrorType, WalletType } from '@/types/WalletTypes';

const ADDRESS = '0xdb8109A158EF6DB939c9cFE16Fff01779121E187';
const software = { id: 'sw', type: WalletType.SOFTWARE, address: ADDRESS };
const satochip = { id: 'sc', type: WalletType.SATOCHIP, address: ADDRESS.toLowerCase() };
const other = { id: 'other', type: WalletType.SATOCHIP, address: '0x' + '11'.repeat(20) };

function expectWalletError(fn: () => unknown, type: WalletErrorType) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(WalletError);
    expect((e as WalletError).type).toBe(type);
    return;
  }
  throw new Error('expected a WalletError');
}

describe('resolveSigningWallet', () => {
  beforeEach(() => {
    mockWallets.length = 0;
  });

  it('uses the only account with the address', () => {
    mockWallets.push(satochip, other);
    expect(resolveSigningWallet(ADDRESS)).toBe(satochip);
  });

  it('refuses to guess when several accounts share the address', () => {
    mockWallets.push(software, satochip); // software loaded first, as in the bug report
    expectWalletError(() => resolveSigningWallet(ADDRESS), WalletErrorType.WALLET_NOT_SET);
  });

  it('signs with the account chosen by the caller', () => {
    mockWallets.push(software, satochip);
    expect(resolveSigningWallet(ADDRESS, satochip as any)).toBe(satochip);
    expect(resolveSigningWallet(ADDRESS, software as any)).toBe(software);
  });

  it('rejects a chosen account with another address', () => {
    mockWallets.push(software, satochip, other);
    expectWalletError(() => resolveSigningWallet(ADDRESS, other as any), WalletErrorType.INVALID_ADDRESS);
  });

  it('fails when no account has the address', () => {
    mockWallets.push(other);
    expectWalletError(() => resolveSigningWallet(ADDRESS), WalletErrorType.DEVICE_NOT_FOUND);
  });
});
