/**
 * @jest-environment node
 *
 * Software (BIP39) accounts pair like Satochip accounts: ur:crypto-hdkey with
 * the account-level xpub (m/44'/60'/0') and the master fingerprint, recorded
 * when the wallet is unlocked. Acceptance with MetaMask and Keystone keyrings.
 */
import { ethers } from 'ethers';
import { Common, Chain, Hardfork } from '@ethereumjs/common';
import { BaseKeyring } from '@keystonehq/base-eth-keyring';
import { QrKeyring } from '@metamask/eth-qr-keyring';
import { EthSignRequest } from '@keystonehq/bc-ur-registry-eth';

jest.mock('@/wallets/WalletEncryptionService', () => ({ WalletEncryptionService: {} }));

import { EIP155SoftwareWallet } from '@/wallets/EIP155SoftwareWallet';
import { SoftwareWalletInfo, WalletType } from '@/types/WalletTypes';
import { buildSyncUR } from '../../src/airgap/syncPayload';
import { URScanner, createURFrameEncoder, makeUR } from '../../src/airgap/urCodec';
import { AirgapAccount, parseSignRequestUR } from '../../src/airgap/signRequest';
import { finalizeRawSignature } from '../../src/airgap/signing';
import { buildSignatureUR } from '../../src/airgap/signatureResponse';
import { accountInfo, masterXfp as satochipXfp, TEST_MNEMONIC } from './helpers';

const keystoneRegistry = require('@keystonehq/base-eth-keyring/node_modules/@keystonehq/bc-ur-registry-eth');
const metamaskTx = require(require('path').join(__dirname, '../../node_modules/@metamask/eth-qr-keyring/node_modules/@ethereumjs/tx'));

/** A software account at m/44'/60'/0'/0/<index> of the test mnemonic, unlocked. */
function softwareAccount(index: number, mnemonic = TEST_MNEMONIC): EIP155SoftwareWallet {
  const path = `m/44'/60'/0'/0/${index}`;
  const address = ethers.utils.HDNode.fromMnemonic(mnemonic).derivePath(path).address;
  const info: SoftwareWalletInfo = {
    id: `software-eip155-${path}`,
    name: `Soft ${index}`,
    type: WalletType.SOFTWARE,
    address,
    blockchain: 'eip155',
    encryptedBlob: '',
  };
  return new EIP155SoftwareWallet(info, { keyType: 'mnemonic', mnemonic, passphrase: '', derivationPath: path });
}

/** Routing entry as built by storeAccounts.getAirgapAccounts() for a software account. */
function hdEntry(wallet: EIP155SoftwareWallet): AirgapAccount {
  const info = wallet.getWalletInfo();
  return {
    id: wallet.id,
    name: info.name,
    address: info.address,
    masterXfp: info.masterXfp!,
    derivationPath: info.derivationPath!,
    kind: 'hd',
  };
}

function transmit(ur: { type: string; cbor: Buffer }) {
  const enc = createURFrameEncoder(makeUR(Buffer.from(ur.cbor), ur.type), 100);
  const scanner = new URScanner();
  for (let i = 0; i < (enc.isSinglePart ? 1 : enc.fragmentCount * 4) && !scanner.isDone(); i++) {
    expect(scanner.receivePart(enc.nextFrame()).error).toBeUndefined();
  }
  return scanner.getResult()!;
}

const soft2 = softwareAccount(2);
const wallets = new Map([[soft2.id, soft2]]);
const accounts = [hdEntry(soft2)];

/** The app: route by xfp + path, sign with the routed software wallet. */
async function appHandleSignRequest(request: { type: string; cbor: Buffer }) {
  const parsed = parseSignRequestUR(transmit(request), accounts);
  const wallet = wallets.get(parsed.account.id)!; // store lookup by wallet id
  const { r, s } = wallet.signDigest(parsed.hash);
  const sig = await finalizeRawSignature(parsed.hash, r, s, parsed.account.address, parsed.dataType, parsed.chainId);
  return transmit(buildSignatureUR(parsed.requestId, sig) as unknown as { type: string; cbor: Buffer });
}

const syncUR = () => {
  const info = soft2.getWalletInfo();
  return transmit(buildSyncUR({ masterXfp: info.masterXfp!, xpub: info.xpub! }, 'SC Software') as unknown as { type: string; cbor: Buffer });
};

describe('pairing data recorded on unlock', () => {
  test('xpub at m/44\'/60\'/0\', master fingerprint and path, same as a Satochip with the same seed', () => {
    const info = soft2.getWalletInfo();
    const root = ethers.utils.HDNode.fromMnemonic(TEST_MNEMONIC);
    expect(info.keyType).toBe('mnemonic');
    expect(info.derivationPath).toBe("m/44'/60'/0'/0/2");
    expect(info.masterXfp).toBe(satochipXfp);
    expect(info.xpub).toBe(root.derivePath("m/44'/60'/0'").neuter().extendedKey);
    const accountKey = root.derivePath("m/44'/60'/0'/0/2").publicKey; // compressed
    expect(info.publicKey).toBe(accountKey.slice(2));
    // routing id = store key (wallet.id), not info.id
    expect(hdEntry(soft2).id).toBe(soft2.id);
    expect(soft2.id).not.toBe(info.id);
  });

  test('private-key accounts get a public key but no xpub', () => {
    const key = '0x' + '11'.repeat(32);
    const w = new EIP155SoftwareWallet(
      { id: 'pk', name: 'PK', type: WalletType.SOFTWARE, address: new ethers.Wallet(key).address, blockchain: 'eip155', encryptedBlob: '' },
      { keyType: 'privateKey', privateKey: key },
    );
    expect(w.getWalletInfo().keyType).toBe('privateKey');
    expect(w.getWalletInfo().xpub).toBeUndefined();
    expect(w.getWalletInfo().publicKey).toHaveLength(66);
  });
});

describe('routing', () => {
  test('a Satochip account and a software account from the same seed both match', () => {
    const satochip = { ...accountInfo(2), kind: 'hd' as const };
    expect(satochip.masterXfp).toBe(hdEntry(soft2).masterXfp);
    expect(satochip.derivationPath).toBe(hdEntry(soft2).derivationPath);
    expect(satochip.address).toBe(soft2.address); // same key: the review screen lets the user choose
  });

  test('an index of the seed without an account in the app is refused', async () => {
    const keyring = new QrKeyring({ bridge: { requestScan: async () => ({}) } } as any);
    keyring.pairDevice({ type: 'crypto-hdkey', cbor: syncUR().cbor.toString('hex') });
    const page = await keyring.getFirstPage();
    const req = EthSignRequest.constructETHRequest(
      Buffer.from('hi'), 3, "m/44'/60'/0'/0/0", satochipXfp, undefined, undefined, page[0].address,
    ).toUR();
    expect(() => parseSignRequestUR({ type: req.type, cbor: req.cbor }, accounts)).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_PATH' }),
    );
  });
});

const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'chainId', type: 'uint256' },
    ],
    Mail: [{ name: 'contents', type: 'string' }],
  },
  primaryType: 'Mail',
  domain: { name: 'Test', chainId: 11155111 },
  message: { contents: 'hello' },
};

function eip1559(txLib: any) {
  const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.London });
  return txLib.FeeMarketEIP1559Transaction.fromTxData(
    { chainId: 11155111, nonce: 1, maxPriorityFeePerGas: 1n, maxFeePerGas: 2n, gasLimit: 21000, to: accountInfo(0).address, value: 1n, accessList: [] },
    { common },
  );
}

function senderOf(signedTx: any): string {
  return ethers.utils.parseTransaction('0x' + Buffer.from(signedTx.serialize()).toString('hex')).from!;
}

describe('MetaMask (@metamask/eth-qr-keyring) with crypto-hdkey', () => {
  const keyring = new QrKeyring({
    bridge: {
      requestScan: async (request: any) => {
        if (request.type === 'pair') {
          const ur = syncUR();
          return { type: ur.type, cbor: ur.cbor.toString('hex') };
        }
        const { payload } = request.request;
        const sig = await appHandleSignRequest({ type: payload.type, cbor: Buffer.from(payload.cbor, 'hex') });
        return { type: sig.type, cbor: sig.cbor.toString('hex') };
      },
    },
  } as any);
  const address = soft2.address as `0x${string}`;

  test('address #3 of the seed is the account, and signs', async () => {
    const page = await keyring.getFirstPage();
    expect(page[2].address).toBe(soft2.address);
    expect(keyring.getName()).toBe('SC Software');
    expect(senderOf(await keyring.signTransaction(address, eip1559(metamaskTx)))).toBe(soft2.address);
    const sig = await keyring.signPersonalMessage(address, '0x68656c6c6f');
    expect(ethers.utils.verifyMessage('hello', sig)).toBe(soft2.address);
    const typedSig = await keyring.signTypedData(address, typedData as any);
    expect(ethers.utils.verifyTypedData(typedData.domain, { Mail: typedData.types.Mail }, typedData.message, typedSig)).toBe(soft2.address);
  });
});

describe('Keystone (@keystonehq/base-eth-keyring) with crypto-hdkey', () => {
  class TestKeyring extends BaseKeyring {
    getInteraction = () => ({
      readCryptoHDKeyOrCryptoAccount: async () => keystoneRegistry.CryptoHDKey.fromCBOR(syncUR().cbor),
      requestSignature: async (signRequest: any) => {
        const ur = signRequest.toUR();
        const sig = await appHandleSignRequest({ type: ur.type, cbor: ur.cbor });
        return keystoneRegistry.ETHSignature.fromCBOR(sig.cbor);
      },
    });
  }

  test('address #3 of the seed is the account, and signs', async () => {
    const keyring = new TestKeyring();
    await keyring.readKeyring();
    await keyring.addAccounts(3);
    expect((await keyring.getAccounts())[2]).toBe(soft2.address);
    const sig = await keyring.signPersonalMessage(soft2.address, '0x68656c6c6f');
    expect(ethers.utils.verifyMessage('hello', sig)).toBe(soft2.address);
  });
});
