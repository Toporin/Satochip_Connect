/**
 * @jest-environment node
 *
 * End-to-end interop test with @keystonehq/base-eth-keyring (the keyring used by
 * MetaMask's QR hardware wallet support). No device: the card is mocked.
 *
 * sync UR -> keyring; keyring sign request UR -> parseSignRequest -> mock card
 * -> finalizeSignature -> eth-signature UR -> keyring -> verify signer.
 */
import { ethers } from 'ethers';
import { BaseKeyring } from '@keystonehq/base-eth-keyring';
import { Common, Chain, Hardfork } from '@ethereumjs/common';
import { LegacyTransaction, FeeMarketEIP1559Transaction } from '@ethereumjs/tx';

import {
  buildSyncUR,
  createURFrameEncoder,
  URScanner,
  parseSignRequestUR,
  finalizeSignature,
  buildSignatureUR,
} from '../../src/airgap';
import { accountInfo, masterXfp, xpub, mockCardSign } from './helpers';

// The keyring ships its own copy of the registry (0.19.x): decode with it,
// exactly like MetaMask does.
const keyringRegistry = require('@keystonehq/base-eth-keyring/node_modules/@keystonehq/bc-ur-registry-eth');

const accounts = [0, 1, 2].map(accountInfo);

/** Pass a UR through animated frames (shuffled + duplicated) and decode it. */
function transmit(ur: { type: string; cbor: Buffer }, maxFragmentLength = 120) {
  const enc = createURFrameEncoder(ur as any, maxFragmentLength);
  const scanner = new URScanner();
  const frames: string[] = [];
  const count = enc.isSinglePart ? 1 : enc.fragmentCount * 3;
  for (let i = 0; i < count; i++) {
    frames.push(enc.nextFrame());
  }
  // shuffle deterministically and duplicate some frames
  const shuffled = frames
    .map((f, i) => ({ f, k: (i * 7919) % 101 }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.f);
  for (const f of [...shuffled, ...shuffled.slice(0, 3)]) {
    const res = scanner.receivePart(f);
    expect(res.error).toBeUndefined();
    if (res.done) {
      break;
    }
  }
  const result = scanner.getResult();
  expect(result).toBeDefined();
  return result!;
}

let highS = false;

class TestKeyring extends BaseKeyring {
  getInteraction = () => ({
    readCryptoHDKeyOrCryptoAccount: async () => {
      const scanned = transmit(buildSyncUR({ masterXfp, xpub }) as any);
      expect(scanned.type).toBe('crypto-hdkey');
      return keyringRegistry.CryptoHDKey.fromCBOR(scanned.cbor);
    },
    requestSignature: async (signRequest: any) => {
      // keyring -> app
      const scannedRequest = transmit(signRequest.toUR());
      const parsed = parseSignRequestUR(scannedRequest, accounts);
      // app -> card (mock)
      const der = mockCardSign(parsed.account.derivationPath, parsed.hash, highS);
      highS = !highS; // alternate to exercise low-s normalization
      const sig = await finalizeSignature(
        parsed.hash,
        der,
        parsed.account.address,
        parsed.dataType,
        parsed.chainId,
      );
      // app -> keyring
      const scannedSig = transmit(buildSignatureUR(parsed.requestId, sig) as any);
      expect(scannedSig.type).toBe('eth-signature');
      return keyringRegistry.ETHSignature.fromCBOR(scannedSig.cbor);
    },
  });
}

describe('ERC-4527 interop with @keystonehq/base-eth-keyring', () => {
  let keyring: TestKeyring;

  beforeAll(async () => {
    keyring = new TestKeyring();
    await keyring.readKeyring();
    await keyring.addAccounts(3);
  });

  it('derives the same addresses from the sync QR', async () => {
    const kAccounts = await keyring.getAccounts();
    expect(kAccounts.map((a: string) => a.toLowerCase())).toEqual(
      accounts.map(a => a.address.toLowerCase()),
    );
    const serialized: any = await keyring.serialize();
    expect(serialized.xfp).toBe(masterXfp.toLowerCase());
    expect(serialized.xpub).toBe(xpub);
    expect(serialized.hdPath).toBe("m/44'/60'/0'");
    expect(serialized.childrenPath).toBe('0/*');
    expect(serialized.keyringAccount).toBe('account.standard');
  });

  it('signs a legacy (EIP-155) transaction', async () => {
    const common = new Common({ chain: Chain.Sepolia, hardfork: Hardfork.London });
    const tx = LegacyTransaction.fromTxData(
      {
        nonce: 7,
        gasPrice: 20_000_000_000n,
        gasLimit: 21000,
        to: accounts[2].address as `0x${string}`,
        value: 10n ** 16n,
        data: '0x',
      },
      { common },
    );
    const signed: any = await keyring.signTransaction(accounts[1].address, tx);
    expect(signed.verifySignature()).toBe(true);
    expect(signed.getSenderAddress().toString().toLowerCase()).toBe(accounts[1].address.toLowerCase());
    // also check with ethers
    const parsed = ethers.utils.parseTransaction('0x' + Buffer.from(signed.serialize()).toString('hex'));
    expect(parsed.from!.toLowerCase()).toBe(accounts[1].address.toLowerCase());
    expect(parsed.chainId).toBe(11155111);
  });

  it('signs a legacy transaction on a chain id that needs a multi-byte v', async () => {
    const common = Common.custom({ chainId: 1_000_000, networkId: 1_000_000 }, { hardfork: Hardfork.London });
    const tx = LegacyTransaction.fromTxData(
      { nonce: 1, gasPrice: 1n, gasLimit: 21000, to: accounts[0].address as `0x${string}`, value: 1n },
      { common },
    );
    const signed: any = await keyring.signTransaction(accounts[0].address, tx);
    expect(signed.getSenderAddress().toString().toLowerCase()).toBe(accounts[0].address.toLowerCase());
  });

  it('signs an EIP-1559 transaction', async () => {
    const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London });
    const tx = FeeMarketEIP1559Transaction.fromTxData(
      {
        chainId: 1,
        nonce: 3,
        maxPriorityFeePerGas: 1_000_000_000n,
        maxFeePerGas: 30_000_000_000n,
        gasLimit: 60000,
        to: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        value: 0n,
        // ERC-20 transfer(accounts[2], 1e18)
        data: ('0xa9059cbb' +
          ethers.utils.defaultAbiCoder
            .encode(['address', 'uint256'], [accounts[2].address, ethers.constants.WeiPerEther])
            .slice(2)) as `0x${string}`,
        accessList: [],
      },
      { common },
    );
    const signed: any = await keyring.signTransaction(accounts[0].address, tx);
    expect(signed.verifySignature()).toBe(true);
    expect(signed.getSenderAddress().toString().toLowerCase()).toBe(accounts[0].address.toLowerCase());
    const parsed = ethers.utils.parseTransaction('0x' + Buffer.from(signed.serialize()).toString('hex'));
    expect(parsed.from!.toLowerCase()).toBe(accounts[0].address.toLowerCase());
  });

  it('signs a personal message', async () => {
    const message = 'Hello from Satochip-Connect';
    const sig = await keyring.signPersonalMessage(
      accounts[0].address,
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message)),
    );
    expect(sig.length).toBe(2 + 65 * 2);
    expect(ethers.utils.verifyMessage(message, sig).toLowerCase()).toBe(accounts[0].address.toLowerCase());
    const v = parseInt(sig.slice(-2), 16);
    expect([27, 28]).toContain(v);
  });

  it('signs EIP-712 v4 typed data (EIP-2612 permit)', async () => {
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
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 1,
        verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      message: {
        owner: accounts[1].address,
        spender: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        value: '1000000',
        nonce: 0,
        deadline: 1893456000,
      },
    };
    const sig = await keyring.signTypedData(accounts[1].address, typedData);
    const { EIP712Domain, ...types } = typedData.types;
    expect(EIP712Domain).toBeDefined();
    const recovered = ethers.utils.verifyTypedData(typedData.domain, types, typedData.message, sig);
    expect(recovered.toLowerCase()).toBe(accounts[1].address.toLowerCase());
  });
});
