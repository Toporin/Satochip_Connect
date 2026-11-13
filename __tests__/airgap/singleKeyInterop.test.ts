/**
 * @jest-environment node
 *
 * Acceptance test: crypto-account pairing for a single-key account with both
 * @metamask/eth-qr-keyring (MetaMask) and @keystonehq/base-eth-keyring
 * (Rabby, older MetaMask). The app side is mocked with a fixed private key.
 *
 * pair from our ur:crypto-account -> 5 addresses, #1 = account
 * address #1: legacy tx, EIP-1559 tx, personal_sign, EIP-712 v4 round-trip
 * address #2: rejected with HELPER_ADDRESS_SELECTED, signer never called
 *
 * Note: @metamask/eth-qr-keyring requires Node >= 22.
 */
import { ethers } from 'ethers';
import { Common, Chain, Hardfork } from '@ethereumjs/common';
import { BaseKeyring } from '@keystonehq/base-eth-keyring';
import { QrKeyring } from '@metamask/eth-qr-keyring';

import { buildSingleKeyPairing, SOFTWARE_DEVICE_NAME } from '../../src/airgap/singleKeyPayload';
import { singleKeyAirgapAccount } from '../../src/airgap/accounts';
import { URScanner, createURFrameEncoder, makeUR } from '../../src/airgap/urCodec';
import { parseSignRequestUR } from '../../src/airgap/signRequest';
import { finalizeRawSignature } from '../../src/airgap/signing';
import { buildSignatureUR } from '../../src/airgap/signatureResponse';
import { accountInfo } from './helpers';

// Each keyring ships its own copies of the registry / tx libraries: use them.
const keystoneRegistry = require('@keystonehq/base-eth-keyring/node_modules/@keystonehq/bc-ur-registry-eth');
const metamaskTx = require(require('path').join(__dirname, '../../node_modules/@metamask/eth-qr-keyring/node_modules/@ethereumjs/tx'));
const keystoneTx = require('@ethereumjs/tx');

const KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
const wallet = new ethers.Wallet(KEY);
const address = wallet.address as `0x${string}`;
const pairing = buildSingleKeyPairing(wallet.publicKey, SOFTWARE_DEVICE_NAME);
const accounts = [
  { ...accountInfo(0), kind: 'hd' as const },
  singleKeyAirgapAccount('software-eip155-test', 'Test', wallet.address, wallet.publicKey),
];

/** Send a UR through animated QR frames (shuffled + duplicated) and decode it. */
function transmit(ur: { type: string; cbor: Buffer }) {
  const enc = createURFrameEncoder(makeUR(Buffer.from(ur.cbor), ur.type), 100);
  const frames: string[] = [];
  for (let i = 0; i < (enc.isSinglePart ? 1 : enc.fragmentCount * 3); i++) {
    frames.push(enc.nextFrame());
  }
  const shuffled = frames.map((f, i) => ({ f, k: (i * 7919) % 101 })).sort((a, b) => a.k - b.k).map(x => x.f);
  const scanner = new URScanner();
  for (const frame of [...shuffled, ...shuffled.slice(0, 3)]) {
    expect(scanner.receivePart(frame).error).toBeUndefined();
    if (scanner.isDone()) {
      break;
    }
  }
  return scanner.getResult()!;
}

const signer = jest.fn((hash: string) => wallet._signingKey().signDigest(hash));

/** The app: route the request (helpers rejected first), sign key #1, answer with eth-signature. */
async function appHandleSignRequest(request: { type: string; cbor: Buffer }) {
  const scanned = transmit(request);
  const parsed = parseSignRequestUR(scanned, accounts);
  const { r, s } = signer(parsed.hash);
  const sig = await finalizeRawSignature(parsed.hash, r, s, parsed.account.address, parsed.dataType, parsed.chainId);
  return transmit(buildSignatureUR(parsed.requestId, sig) as unknown as { type: string; cbor: Buffer });
}

const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  domain: { name: 'USD Coin', version: '2', chainId: 11155111, verifyingContract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
  message: { owner: wallet.address, spender: '0x000000000022D473030F116dDEE9F6B43aC78BA3', value: '1000000', nonce: 0, deadline: 1893456000 },
};
const permitTypes = { Permit: typedData.types.Permit };

function legacyTx(txLib: any) {
  const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.London });
  return txLib.LegacyTransaction.fromTxData(
    { nonce: 3, gasPrice: 2_000_000_000n, gasLimit: 21000, to: accountInfo(2).address, value: 10n ** 15n },
    { common },
  );
}

function eip1559Tx(txLib: any) {
  const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.London });
  return txLib.FeeMarketEIP1559Transaction.fromTxData(
    {
      chainId: 11155111,
      nonce: 4,
      maxPriorityFeePerGas: 1_000_000_000n,
      maxFeePerGas: 20_000_000_000n,
      gasLimit: 21000,
      to: accountInfo(2).address,
      value: 1n,
      accessList: [],
    },
    { common },
  );
}

function senderOf(signedTx: any): string {
  const raw = '0x' + Buffer.from(signedTx.serialize()).toString('hex');
  return ethers.utils.parseTransaction(raw).from!;
}

beforeEach(() => signer.mockClear());

describe('MetaMask (@metamask/eth-qr-keyring)', () => {
  const keyring = new QrKeyring({
    bridge: {
      requestScan: async (request: any) => {
        if (request.type === 'pair') {
          const scanned = transmit(pairing.ur as unknown as { type: string; cbor: Buffer });
          return { type: scanned.type, cbor: scanned.cbor.toString('hex') };
        }
        const payload = request.request.payload;
        const signature = await appHandleSignRequest({ type: payload.type, cbor: Buffer.from(payload.cbor, 'hex') });
        return { type: signature.type, cbor: signature.cbor.toString('hex') };
      },
    },
  } as any);

  let page: Array<{ address: string; index: number }>;
  beforeAll(async () => {
    page = await keyring.getFirstPage();
  });

  test('pairing lists 5 addresses, #1 is the account', () => {
    expect(page).toHaveLength(5);
    expect(page[0].address).toBe(wallet.address);
    expect(page.slice(1).map(p => p.address)).toEqual(pairing.helperAddresses);
    expect(keyring.getName()).toBe(SOFTWARE_DEVICE_NAME);
  });

  test('legacy and EIP-1559 transactions for #1', async () => {
    expect(senderOf(await keyring.signTransaction(address, legacyTx(metamaskTx)))).toBe(wallet.address);
    expect(senderOf(await keyring.signTransaction(address, eip1559Tx(metamaskTx)))).toBe(wallet.address);
  });

  test('personal_sign and EIP-712 v4 for #1', async () => {
    const msg = 'Hello from Satochip-Connect';
    const sig = await keyring.signPersonalMessage(address, ethers.utils.hexlify(ethers.utils.toUtf8Bytes(msg)) as `0x${string}`);
    expect(ethers.utils.verifyMessage(msg, sig)).toBe(wallet.address);
    const typedSig = await keyring.signTypedData(address, typedData as any);
    expect(ethers.utils.verifyTypedData(typedData.domain, permitTypes, typedData.message, typedSig)).toBe(wallet.address);
  });

  test('address #2 is rejected with HELPER_ADDRESS_SELECTED, signer never called', async () => {
    await expect(keyring.signPersonalMessage(page[1].address as `0x${string}`, '0x1234')).rejects.toMatchObject({
      code: 'HELPER_ADDRESS_SELECTED',
      helperIndex: 2,
      helperAddress: page[1].address,
      primaryAddress: wallet.address,
    });
    await expect(keyring.signTransaction(page[1].address as `0x${string}`, eip1559Tx(metamaskTx))).rejects.toMatchObject({
      code: 'HELPER_ADDRESS_SELECTED',
    });
    expect(signer).not.toHaveBeenCalled();
  });
});

describe('Keystone (@keystonehq/base-eth-keyring, Rabby)', () => {
  class TestKeyring extends BaseKeyring {
    getInteraction = () => ({
      readCryptoHDKeyOrCryptoAccount: async () => {
        const scanned = transmit(pairing.ur as unknown as { type: string; cbor: Buffer });
        expect(scanned.type).toBe('crypto-account');
        return keystoneRegistry.CryptoAccount.fromCBOR(scanned.cbor);
      },
      requestSignature: async (signRequest: any) => {
        const ur = signRequest.toUR();
        const signature = await appHandleSignRequest({ type: ur.type, cbor: ur.cbor });
        return keystoneRegistry.ETHSignature.fromCBOR(signature.cbor);
      },
    });
  }
  const keyring = new TestKeyring();
  let page: Array<{ address: string; index: number }>;
  beforeAll(async () => {
    page = await keyring.getFirstPage();
  });

  test('pairing lists 5 addresses, #1 is the account', () => {
    expect(page).toHaveLength(5);
    expect(page[0].address).toBe(wallet.address);
    expect(keyring.getName()).toBe(SOFTWARE_DEVICE_NAME);
  });

  test('legacy and EIP-1559 transactions for #1', async () => {
    expect(senderOf(await keyring.signTransaction(address, legacyTx(keystoneTx)))).toBe(wallet.address);
    expect(senderOf(await keyring.signTransaction(address, eip1559Tx(keystoneTx)))).toBe(wallet.address);
  });

  test('personal_sign and EIP-712 v4 for #1', async () => {
    const msg = 'Hello Rabby';
    const sig = await keyring.signPersonalMessage(address, ethers.utils.hexlify(ethers.utils.toUtf8Bytes(msg)));
    expect(ethers.utils.verifyMessage(msg, sig)).toBe(wallet.address);
    const typedSig = await keyring.signTypedData(address, typedData);
    expect(ethers.utils.verifyTypedData(typedData.domain, permitTypes, typedData.message, typedSig)).toBe(wallet.address);
  });

  test('address #2 is rejected with HELPER_ADDRESS_SELECTED, signer never called', async () => {
    await expect(keyring.signPersonalMessage(page[1].address as `0x${string}`, '0x1234')).rejects.toMatchObject({
      code: 'HELPER_ADDRESS_SELECTED',
      helperIndex: 2,
    });
    expect(signer).not.toHaveBeenCalled();
  });
});
