/**
 * @jest-environment node
 *
 * crypto-account pairing for single-key accounts: fingerprint, helper keys,
 * descriptor layout and sign-request routing (helper keys are rejected before
 * any signer is called).
 */
import { ethers } from 'ethers';
import { CryptoAccount, DataType, EthSignRequest } from '@keystonehq/bc-ur-registry-eth';

import {
  buildSingleKeyPairing,
  helperPublicKeys,
  satodimeDeviceName,
  singleKeyFingerprint,
  SOFTWARE_DEVICE_NAME,
} from '../../src/airgap/singleKeyPayload';
import { singleKeyAirgapAccount } from '../../src/airgap/accounts';
import { AirgapError, HelperAddressError, parseSignRequestCBOR } from '../../src/airgap/signRequest';
import { accountInfo } from './helpers';

const N = ethers.BigNumber.from('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
const wallet = new ethers.Wallet(KEY);

describe('fingerprint', () => {
  test('hash160(P)[0..4] of the generator point (private key 1)', () => {
    // hash160(G compressed) = 751e76e8199196d454941c45d1b3a323f1433bd6 (BIP-173 example)
    const g = ethers.utils.computePublicKey('0x' + '00'.repeat(31) + '01', true);
    expect(singleKeyFingerprint(g)).toBe('751e76e8');
  });

  test('same fingerprint from compressed or uncompressed keys, with or without 0x', () => {
    const fp = singleKeyFingerprint(wallet.publicKey);
    expect(singleKeyFingerprint(ethers.utils.computePublicKey(wallet.publicKey, true))).toBe(fp);
    expect(singleKeyFingerprint(wallet.publicKey.slice(2))).toBe(fp);
  });
});

describe('helper keys', () => {
  test('helper a = a·P, whose address is computeAddress(a·k mod n) (recoverable)', () => {
    const keys = helperPublicKeys(wallet.publicKey);
    expect(keys).toHaveLength(5);
    expect(ethers.utils.computeAddress(keys[0])).toBe(wallet.address);
    for (let a = 2; a <= 5; a++) {
      const ak = ethers.BigNumber.from(KEY).mul(a).mod(N);
      const expected = ethers.utils.computeAddress(ethers.utils.hexZeroPad(ak.toHexString(), 32));
      expect(ethers.utils.computeAddress(keys[a - 1])).toBe(expected);
    }
  });
});

describe('crypto-account payload', () => {
  test('5 descriptors in order, same name, fingerprint read back as hex', () => {
    const name = satodimeDeviceName(1);
    expect(name).toBe('Satodime #2 - use #1 only');
    const pairing = buildSingleKeyPairing(wallet.publicKey, name);
    expect(pairing.ur.type).toBe('crypto-account');
    const account = CryptoAccount.fromCBOR(pairing.ur.cbor);
    expect(account.getMasterFingerprint().toString('hex')).toBe(pairing.fingerprint);
    const outputs = account.getOutputDescriptors();
    expect(outputs).toHaveLength(5);
    outputs.forEach((output, i) => {
      const hdKey = output.getHDKey()!;
      expect(hdKey.getOrigin()!.getPath()).toBe(`44'/60'/0'/0/${i}`);
      expect(hdKey.getOrigin()!.getSourceFingerprint()!.toString('hex')).toBe(pairing.fingerprint);
      expect(hdKey.getName()).toBe(name);
      expect(hdKey.getNote()).toBe('account.ledger_live');
      expect(hdKey.isPrivateKey()).toBe(false);
      expect(hdKey.getKey().length).toBe(33);
      const address = ethers.utils.computeAddress(hdKey.getKey());
      expect(address).toBe(i === 0 ? wallet.address : pairing.helperAddresses[i - 1]);
    });
    expect(new Set([pairing.primaryAddress, ...pairing.helperAddresses]).size).toBe(5);
    expect(SOFTWARE_DEVICE_NAME).toBe('SC Software - use #1 only');
  });
});

describe('sign-request routing', () => {
  const single = singleKeyAirgapAccount('software-eip155-test', 'Test', wallet.address, wallet.publicKey);
  const satochip = { ...accountInfo(0), kind: 'hd' as const };
  const accounts = [satochip, single];
  const message = Buffer.from('hello');

  function request(index: number, opts: { xfp?: string; address?: string } = {}): Buffer {
    return EthSignRequest.constructETHRequest(
      message,
      DataType.personalMessage,
      `M/44'/60'/0'/0/${index}`,
      opts.xfp ?? single.masterXfp,
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      undefined,
      opts.address,
    ).toCBOR();
  }

  /** What the app does: route first, sign only if routing succeeded. */
  function routeAndSign(cbor: Buffer, signer: jest.Mock) {
    const parsed = parseSignRequestCBOR(cbor, accounts);
    return signer(parsed.hash);
  }

  test('fingerprint + index 0 routes to the account (address checked)', () => {
    const parsed = parseSignRequestCBOR(request(0, { address: wallet.address }), accounts);
    expect(parsed.account.id).toBe('software-eip155-test');
    expect(parsed.hash).toBe(ethers.utils.hashMessage(message));
    expect(() => parseSignRequestCBOR(request(0, { address: single.helperAddresses![0] }), accounts)).toThrow(
      expect.objectContaining({ code: 'ADDRESS_MISMATCH' }),
    );
  });

  test('Satochip routing is unchanged', () => {
    const cbor = EthSignRequest.constructETHRequest(
      message, DataType.personalMessage, satochip.derivationPath, satochip.masterXfp,
    ).toCBOR();
    expect(parseSignRequestCBOR(cbor, accounts).account.id).toBe(satochip.id);
  });

  test.each([1, 2, 3, 4])('index %i is a helper key: rejected before signing', index => {
    const signer = jest.fn();
    let error: unknown;
    try {
      routeAndSign(request(index), signer);
    } catch (e) {
      error = e;
    }
    expect(signer).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(HelperAddressError);
    const helperError = error as HelperAddressError;
    expect(helperError.code).toBe('HELPER_ADDRESS_SELECTED');
    expect(helperError.helperIndex).toBe(index + 1);
    expect(helperError.helperAddress).toBe(single.helperAddresses![index - 1]);
    expect(helperError.primaryAddress).toBe(wallet.address);
    expect(helperError.accountId).toBe('software-eip155-test');
  });

  test('unknown index and fingerprint collisions are rejected', () => {
    const signer = jest.fn();
    expect(() => routeAndSign(request(5), signer)).toThrow(expect.objectContaining({ code: 'UNKNOWN_PATH' }));
    const twin = { ...single, id: 'other' };
    expect(() => parseSignRequestCBOR(request(0), [single, twin])).toThrow(
      expect.objectContaining({ code: 'FINGERPRINT_COLLISION' }),
    );
    expect(() => parseSignRequestCBOR(request(0, { xfp: 'deadbeef' }), accounts)).toThrow(AirgapError);
    expect(signer).not.toHaveBeenCalled();
  });

  test('a public key that does not match the account address is refused', () => {
    expect(() => singleKeyAirgapAccount('x', 'X', accountInfo(1).address, wallet.publicKey)).toThrow();
  });
});
