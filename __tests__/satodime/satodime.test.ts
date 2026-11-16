/**
 * @jest-environment node
 *
 * Satodime accounts: SLIP-44 mapping, EIP-55 address derivation, signing with
 * a mocked card (DER signatures, sometimes high-S), and the card/vault checks
 * done before signing.
 */
import { ethers } from 'ethers';

// In-memory keychain
const mockKeychain = new Map<string, string>();
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
  setGenericPassword: async (_u: string, password: string, opts: { service: string }) => {
    mockKeychain.set(opts.service, password);
    return { service: opts.service, storage: 'test' };
  },
  getGenericPassword: async (opts: { service: string }) =>
    mockKeychain.has(opts.service) ? { username: 'u', password: mockKeychain.get(opts.service), service: opts.service, storage: 'test' } : false,
  resetGenericPassword: async (opts: { service: string }) => mockKeychain.delete(opts.service),
}));
// The library is only used for types and two pure helpers here
jest.mock('satochip-react-native', () => ({
  formatCardVersion: (v: { protocolMajor: number; protocolMinor: number; appletMajor: number; appletMinor: number }) =>
    `v${v.protocolMajor}.${v.protocolMinor}-${v.appletMajor}.${v.appletMinor}`,
  cvcToUnlockSecret: (cvc: string) => {
    const b = Buffer.alloc(20, 0);
    Buffer.from(cvc).copy(b);
    return b;
  },
}));
// Chain constants pull in image assets and env config: not needed here
jest.mock('@/constants/Eip155', () => ({ EIP155_RPCS_BY_CHAINS: {} }));
jest.mock('@/wallets/nfc/NFCManager', () => ({ NFCManager: { getInstance: () => ({}) } }));

import { decodeSatodimeSlip44 } from '@/constants/Satodime';
import { SatodimeInfo, SatodimeVaultState, WalletType } from '@/types/WalletTypes';
import { SecretStore } from '@/utils/SecretStore';
import {
  readSatodimeCardState,
  releaseSatodimeOwnership,
  satodimeAddressFromPubkey,
  signDigestWithSatodime,
} from '@/wallets/satodime/SatodimeClient';
import {
  DigestSigner,
  signMessageWithDigestSigner,
  signTransactionWithDigestSigner,
  signTypedDataWithDigestSigner,
} from '@/wallets/satodime/SatodimeSigning';
import { SatodimeWallet } from '@/wallets/satodime/SatodimeWallet';

const N = ethers.BigNumber.from('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

function derInt(hex: string): Buffer {
  let b = Buffer.from(ethers.utils.stripZeros(hex));
  if (b.length === 0) b = Buffer.from([0]);
  if (b[0] >= 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return Buffer.concat([Buffer.from([0x02, b.length]), b]);
}

function toDER(r: string, s: string): Buffer {
  const body = Buffer.concat([derInt(r), derInt(s)]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

/** A vault key that signs digests like the card does (DER, s not normalized). */
function vaultKey(privateKey: string) {
  const signingKey = new ethers.utils.SigningKey(privateKey);
  let highS = false;
  const signer: DigestSigner = async (digest: Buffer) => {
    const sig = signingKey.signDigest(digest);
    const s = highS ? ethers.utils.hexZeroPad(N.sub(sig.s).toHexString(), 32) : sig.s;
    highS = !highS; // alternate low-S / high-S
    return toDER(sig.r, s);
  };
  return {
    signer,
    pubkey: signingKey.publicKey.slice(2), // uncompressed, no 0x
    address: ethers.utils.computeAddress(signingKey.publicKey),
  };
}

const VAULT = vaultKey('0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318');
const AUTHENTIKEY = '02' + '11'.repeat(32);

describe('SLIP-44 mapping', () => {
  test('ETH / POL mainnet and testnet, MSB set = mainnet', () => {
    expect(decodeSatodimeSlip44(0x8000003c)).toMatchObject({ symbol: 'ETH', isTestnet: false, supported: true, defaultChainId: 1 });
    expect(decodeSatodimeSlip44(0x0000003c)).toMatchObject({ symbol: 'ETH', isTestnet: true, supported: true, defaultChainId: 11155111 });
    expect(decodeSatodimeSlip44(0x800003c6)).toMatchObject({ symbol: 'POL', isTestnet: false, supported: true, defaultChainId: 137 });
    expect(decodeSatodimeSlip44(0x000003c6)).toMatchObject({ symbol: 'POL', isTestnet: true, supported: true, defaultChainId: 80002 });
  });

  test('Bitcoin family is unsupported, unknown coins are UNKNOWN', () => {
    for (const raw of [0x80000000, 0x80000002, 0x80000009, 0x80000091]) {
      expect(decodeSatodimeSlip44(raw).supported).toBe(false);
    }
    expect(decodeSatodimeSlip44(0x80000091).symbol).toBe('BCH');
    expect(decodeSatodimeSlip44(0x80001234)).toMatchObject({ symbol: 'UNKNOWN', supported: false });
  });
});

describe('address derivation (EIP-55)', () => {
  test('known vector: private key 1', () => {
    const pubkey = new ethers.utils.SigningKey('0x' + '00'.repeat(31) + '01').publicKey;
    expect(satodimeAddressFromPubkey(pubkey)).toBe('0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
    expect(satodimeAddressFromPubkey(pubkey.slice(2))).toBe('0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
  });

  test('keccak256 of the 64-byte key, last 20 bytes, checksummed', () => {
    const raw = Buffer.from(VAULT.pubkey, 'hex').slice(1);
    const manual = ethers.utils.getAddress('0x' + ethers.utils.keccak256(raw).slice(-40));
    expect(satodimeAddressFromPubkey(VAULT.pubkey)).toBe(manual);
    expect(manual).toBe(VAULT.address);
  });
});

describe('signing with a digest signer (low-S, v recovery)', () => {
  test('personal_sign', async () => {
    for (let i = 0; i < 2; i++) {
      const sig = await signMessageWithDigestSigner(VAULT.signer, 'Hello Satodime', VAULT.address, 1);
      expect(ethers.utils.verifyMessage('Hello Satodime', sig)).toBe(VAULT.address);
      const { s, v } = ethers.utils.splitSignature(sig);
      expect(ethers.BigNumber.from(s).lte(N.div(2))).toBe(true);
      expect([27, 28]).toContain(v);
    }
  });

  test('EIP-712', async () => {
    const domain = { name: 'Test', version: '1', chainId: 137, verifyingContract: '0x' + '22'.repeat(20) };
    const types = { Mail: [{ name: 'contents', type: 'string' }] };
    const value = { contents: 'hi' };
    for (let i = 0; i < 2; i++) {
      const sig = await signTypedDataWithDigestSigner(VAULT.signer, domain, types, value, VAULT.address, 137);
      expect(ethers.utils.verifyTypedData(domain, types, value, sig)).toBe(VAULT.address);
    }
  });

  test('legacy (EIP-155) and EIP-1559 transactions', async () => {
    const base = { from: VAULT.address, to: '0x' + '33'.repeat(20), value: '0x01', nonce: '0x02', gas: '0x5208', data: '0x' };
    for (let i = 0; i < 2; i++) {
      const legacy = await signTransactionWithDigestSigner(VAULT.signer, { ...base, gasPrice: '0x3b9aca00' }, VAULT.address, 11155111);
      const parsedLegacy = ethers.utils.parseTransaction(legacy);
      expect(parsedLegacy.from).toBe(VAULT.address);
      expect(parsedLegacy.chainId).toBe(11155111);
      expect(parsedLegacy.type ?? 0).toBe(0);

      const eip1559 = await signTransactionWithDigestSigner(
        VAULT.signer,
        { ...base, maxFeePerGas: '0x77359400', maxPriorityFeePerGas: '0x3b9aca00' },
        VAULT.address,
        137,
      );
      const parsed1559 = ethers.utils.parseTransaction(eip1559);
      expect(parsed1559.from).toBe(VAULT.address);
      expect(parsed1559.type).toBe(2);
    }
  });

  test('a signature from another key is rejected', async () => {
    const other = vaultKey('0x' + '07'.repeat(32));
    await expect(signMessageWithDigestSigner(other.signer, 'x', VAULT.address, 1)).rejects.toThrow();
  });
});

describe('card and vault checks before signing', () => {
  const info: SatodimeInfo = {
    id: SatodimeWallet.makeId(AUTHENTIKEY, 1),
    name: 'Vault',
    type: WalletType.SATODIME,
    address: VAULT.address,
    blockchain: 'eip155',
    authentikey: AUTHENTIKEY,
    vaultIndex: 1,
    pubkey: VAULT.pubkey,
    slip44: 0x8000003c,
    vaultState: SatodimeVaultState.UNSEALED,
  };
  const digest = Buffer.from(ethers.utils.arrayify(ethers.utils.hashMessage('x')));

  function mockCard(overrides: Partial<{
    protocolMinor: number;
    authentikey: string;
    state: number;
    pubkey: string;
    signError: { statusWord: number };
    setupDone: boolean;
    fixedUnlockSecret: boolean;
    /** successive results of checkUnlockCode() */
    checkResults: boolean[];
  }> = {}) {
    const o = {
      protocolMinor: 2,
      authentikey: AUTHENTIKEY,
      state: 2,
      pubkey: VAULT.pubkey,
      setupDone: true,
      fixedUnlockSecret: false,
      checkResults: [true],
      ...overrides,
    };
    const checks = [...o.checkResults];
    const secrets: Array<Buffer | null> = [];
    const card = {
      getStatus: async () => ({ version: { protocolMajor: 0, protocolMinor: o.protocolMinor, appletMajor: 0, appletMinor: 1, protocolVersion: o.protocolMinor, appletVersion: 1 }, setupDone: o.setupDone, needsSecureChannel: true }),
      getSatodimeStatus: async () => ({ unlockCounter: Buffer.alloc(4), nbKeyslots: 3, keyslotStates: [2, 0, 0], fixedUnlockSecret: o.fixedUnlockSecret }),
      checkUnlockCode: jest.fn(async () => (checks.length > 0 ? checks.shift()! : false)),
      transferOwnership: jest.fn(async () => undefined),
      supportsHashSigning: (s: { version: { protocolVersion: number } }) => s.version.protocolVersion >= 2,
      getAuthentikey: async () => ({ getPublicKeyBytes: () => Buffer.from(o.authentikey, 'hex') }),
      getKeyslotStatus: async () => ({ state: o.state }),
      getPubkey: async () => Buffer.from(o.pubkey, 'hex'),
      setUnlockSecret: (s: Buffer | null) => secrets.push(s),
      signTransactionHash: jest.fn(async (_slot: number, hash: Buffer) => {
        if (o.signError) throw o.signError;
        return VAULT.signer(hash);
      }),
    };
    return { card: card as any, secrets };
  }

  beforeEach(async () => {
    mockKeychain.clear();
    await SecretStore.setSatodimeUnlockSecret(AUTHENTIKEY, Buffer.alloc(20, 9));
  });

  test('signs when every check passes, then forgets the secret', async () => {
    const { card, secrets } = mockCard();
    const der = await signDigestWithSatodime(card, info, digest);
    expect(der[0]).toBe(0x30);
    expect(card.signTransactionHash).toHaveBeenCalledWith(1, digest);
    expect(secrets[0]?.toString('hex')).toBe('09'.repeat(20));
    expect(secrets[secrets.length - 1]).toBeNull();
  });

  test('old card version', async () => {
    const { card } = mockCard({ protocolMinor: 1 });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/v0\.2-0\.1 or later/);
  });

  test('wrong card (authentikey)', async () => {
    const { card } = mockCard({ authentikey: '03' + '44'.repeat(32) });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/Wrong card/);
    expect(card.signTransactionHash).not.toHaveBeenCalled();
  });

  test('sealed vault is watch-only', async () => {
    const { card } = mockCard({ state: 1 });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/sealed/);
  });

  test('reset vault', async () => {
    const { card } = mockCard({ state: 0 });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/empty/);
  });

  test('vault pubkey changed', async () => {
    const { card } = mockCard({ pubkey: vaultKey('0x' + '05'.repeat(32)).pubkey });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/different key/);
    expect(card.signTransactionHash).not.toHaveBeenCalled();
  });

  test('no stored unlock secret', async () => {
    mockKeychain.clear();
    const { card } = mockCard();
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/not the owner/);
  });

  test('counter out of sync (9C50): the secret is kept', async () => {
    const { card } = mockCard({ signError: { statusWord: 0x9c50 } });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/counter out of sync/);
    expect(await SecretStore.hasSatodimeUnlockSecret(AUTHENTIKEY)).toBe(true);
  });

  test('released card (9C04): clear message, secret kept', async () => {
    const { card } = mockCard({ signError: { statusWord: 0x9c04 } });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/no owner/);
    expect(await SecretStore.hasSatodimeUnlockSecret(AUTHENTIKEY)).toBe(true);
  });

  test('ownership lost (9C51): the stale secret is deleted', async () => {
    const { card } = mockCard({ signError: { statusWord: 0x9c51 } });
    await expect(signDigestWithSatodime(card, info, digest)).rejects.toThrow(/not \(or no longer\) the owner/);
    expect(await SecretStore.hasSatodimeUnlockSecret(AUTHENTIKEY)).toBe(false);
  });

  test('end-to-end through SatodimeWallet with the mocked card', async () => {
    const { card } = mockCard();
    const wallet = new SatodimeWallet(info);
    const sig = await wallet.signEthereumMessage('hello', card, VAULT.address, 1);
    expect(ethers.utils.verifyMessage('hello', sig)).toBe(VAULT.address);
    expect(wallet.isWatchOnly()).toBe(false);
    expect(new SatodimeWallet({ ...info, vaultState: SatodimeVaultState.SEALED }).isWatchOnly()).toBe(true);
  });

  describe('card state and ownership', () => {
    test('owned: one transient failure (9C50) is retried, the code is kept', async () => {
      const { card } = mockCard({ checkResults: [false, true] });
      const state = await readSatodimeCardState(card, info);
      expect(state).toMatchObject({ vaultState: 2, setupDone: true, fixedUnlockSecret: false, ownedByThisPhone: true });
      expect(card.checkUnlockCode).toHaveBeenCalledTimes(2);
      expect(await SecretStore.hasSatodimeUnlockSecret(AUTHENTIKEY)).toBe(true);
    });

    test('wrong code twice (9C51): not owner, the stale code is deleted', async () => {
      const { card } = mockCard({ checkResults: [false, false] });
      const state = await readSatodimeCardState(card, info);
      expect(state.ownedByThisPhone).toBe(false);
      expect(await SecretStore.hasSatodimeUnlockSecret(AUTHENTIKEY)).toBe(false);
    });

    test('released card (setup not done) and CVC flag', async () => {
      const { card } = mockCard({ setupDone: false, fixedUnlockSecret: true });
      const state = await readSatodimeCardState(card, info);
      expect(state).toMatchObject({ setupDone: false, fixedUnlockSecret: true, ownedByThisPhone: false });
      expect(card.checkUnlockCode).not.toHaveBeenCalled();
      expect(await SecretStore.hasSatodimeUnlockSecret(AUTHENTIKEY)).toBe(true);
    });

    test('release ownership of a non-CVC card owned here: 0x5A sent, code deleted', async () => {
      const { card } = mockCard();
      await releaseSatodimeOwnership(card, info);
      expect(card.transferOwnership).toHaveBeenCalledTimes(1);
      expect(await SecretStore.hasSatodimeUnlockSecret(AUTHENTIKEY)).toBe(false);
    });

    test('release is refused for CVC cards, wrong cards and when not owner', async () => {
      const cvc = mockCard({ fixedUnlockSecret: true });
      await expect(releaseSatodimeOwnership(cvc.card, info)).rejects.toThrow(/engraved code/);
      const wrong = mockCard({ authentikey: '03' + '44'.repeat(32) });
      await expect(releaseSatodimeOwnership(wrong.card, info)).rejects.toThrow(/Wrong card/);
      const released = mockCard({ setupDone: false });
      await expect(releaseSatodimeOwnership(released.card, info)).rejects.toThrow(/no owner/);
      mockKeychain.clear();
      const notOwner = mockCard();
      await expect(releaseSatodimeOwnership(notOwner.card, info)).rejects.toThrow(/not the owner/);
      for (const m of [cvc, wrong, released, notOwner]) {
        expect(m.card.transferOwnership).not.toHaveBeenCalled();
      }
    });
  });
});
