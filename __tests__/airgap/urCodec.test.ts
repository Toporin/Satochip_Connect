/**
 * @jest-environment node
 */
import { ethers } from 'ethers';
import {
  CryptoHDKey,
  EthSignRequest,
  ETHSignature,
  DataType,
} from '@keystonehq/bc-ur-registry-eth';

import {
  URScanner,
  createURFrameEncoder,
  decodeURParts,
  encodeURFrames,
  isURText,
  makeUR,
  MAX_UR_PART_CHARS,
} from '../../src/airgap/urCodec';
import { buildCryptoHDKey, buildSyncUR } from '../../src/airgap/syncPayload';
import { buildSignatureUR, encodeV, signatureBytes } from '../../src/airgap/signatureResponse';
import { accountInfo, accountNode, masterXfp, xpub } from './helpers';

const REQUEST_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

function bigTypedDataRequest() {
  const message = { contents: 'x'.repeat(3000) };
  const typed = {
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }],
      Mail: [{ name: 'contents', type: 'string' }],
    },
    primaryType: 'Mail',
    domain: { name: 'Test' },
    message,
  };
  return EthSignRequest.constructETHRequest(
    Buffer.from(JSON.stringify(typed), 'utf-8'),
    DataType.typedData,
    "m/44'/60'/0'/0/0",
    masterXfp,
    REQUEST_ID,
    undefined,
    accountInfo(0).address,
    'metamask',
  );
}

describe('isURText', () => {
  it('detects UR text case-insensitively', () => {
    expect(isURText('ur:eth-sign-request/abc')).toBe(true);
    expect(isURText('  UR:ETH-SIGN-REQUEST/ABC')).toBe(true);
    expect(isURText('wc:abc@2?relay-protocol=irn')).toBe(false);
    expect(isURText('')).toBe(false);
  });
});

describe('crypto-hdkey (sync)', () => {
  it('round-trips and reproduces the account xpub', () => {
    const ur = buildSyncUR({ masterXfp, xpub });
    expect(ur.type).toBe('crypto-hdkey');
    const frames = encodeURFrames(ur);
    const decoded = decodeURParts(frames);
    expect(decoded.type).toBe('crypto-hdkey');
    const key = CryptoHDKey.fromCBOR(decoded.cbor);
    expect(key.getBip32Key()).toBe(xpub);
    expect(key.getOrigin()!.getPath()).toBe("44'/60'/0'");
    expect(key.getOrigin()!.getSourceFingerprint()!.toString('hex')).toBe(masterXfp.toLowerCase());
    expect(key.getChildren()!.getPath()).toBe('0/*');
    expect(key.getNote()).toBe('account.standard');
    expect(key.getName()).toBe('Satochip');
    expect(key.isMaster()).toBe(false);
    expect(key.isPrivateKey()).toBe(false);
    expect(key.getParentFingerprint()!.toString('hex')).toBe(accountNode.parentFingerprint.slice(2));
  });

  it('accepts a lowercase xfp and rejects non-account xpubs', () => {
    expect(() => buildCryptoHDKey({ masterXfp: masterXfp.toLowerCase(), xpub })).not.toThrow();
    const deeper = accountNode.derivePath('0').neuter().extendedKey;
    expect(() => buildCryptoHDKey({ masterXfp, xpub: deeper })).toThrow(/depth/);
    expect(() => buildCryptoHDKey({ masterXfp: 'xyz', xpub })).toThrow(/fingerprint/);
  });
});

describe('eth-sign-request multipart', () => {
  it('decodes from shuffled and duplicated fountain frames', () => {
    const req = bigTypedDataRequest();
    const enc = createURFrameEncoder(req.toUR() as any, 100);
    expect(enc.isSinglePart).toBe(false);
    const frames: string[] = [];
    for (let i = 0; i < enc.fragmentCount * 2; i++) {
      frames.push(enc.nextFrame());
    }
    // frames are uppercase (QR alphanumeric mode)
    expect(frames[0]).toBe(frames[0].toUpperCase());
    // reverse order + duplicates
    const shuffled = [...frames].reverse();
    const scanner = new URScanner();
    let lastProgress = 0;
    let done = false;
    for (const f of shuffled) {
      const r1 = scanner.receivePart(f);
      expect(r1.error).toBeUndefined();
      const r2 = scanner.receivePart(f); // duplicate
      expect(r2.duplicate).toBe(true);
      expect(r1.progress).toBeGreaterThanOrEqual(lastProgress);
      lastProgress = r1.progress;
      if (r1.done) {
        done = true;
        break;
      }
    }
    expect(done).toBe(true);
    const result = scanner.getResult()!;
    expect(result.type).toBe('eth-sign-request');
    const decoded = EthSignRequest.fromCBOR(result.cbor);
    expect(decoded.getSignData().equals(req.getSignData())).toBe(true);
    expect(decoded.getOrigin()).toBe('metamask');
  });

  it('restarts when frames of another UR show up', () => {
    const a = createURFrameEncoder(bigTypedDataRequest().toUR() as any, 100);
    const scanner = new URScanner();
    scanner.receivePart(a.nextFrame());
    // a different (single-part) UR
    const other = encodeURFrames(buildSyncUR({ masterXfp, xpub }), 1, 2000)[0];
    const res = scanner.receivePart(other);
    expect(res.done).toBe(true);
    expect(scanner.getResult()!.type).toBe('crypto-hdkey');
  });

  it('reports garbage and oversized input', () => {
    const scanner = new URScanner();
    expect(scanner.receivePart('hello').error).toBeDefined();
    expect(scanner.receivePart('ur:eth-sign-request/1-x/abc').error).toBeDefined();
    expect(scanner.receivePart('ur:' + 'a'.repeat(MAX_UR_PART_CHARS + 1)).error).toMatch(/too large/);
    expect(scanner.receivePart('ur:eth-sign-request/1-99999/lpadaxcfaxhl').error).toMatch(/too long/);
    expect(() => decodeURParts(['ur:bytes/notbytewords'])).toThrow();
  });
});

describe('eth-signature', () => {
  it('round-trips request id, signature and origin', () => {
    const requestId = Buffer.from(REQUEST_ID.replace(/-/g, ''), 'hex');
    const sig = {
      r: '0x' + '11'.repeat(32),
      s: '0x' + '22'.repeat(32),
      v: 27,
    };
    const ur = buildSignatureUR(requestId, sig);
    const decoded = decodeURParts(encodeURFrames(ur));
    expect(decoded.type).toBe('eth-signature');
    const ethSig = ETHSignature.fromCBOR(decoded.cbor);
    expect(ethSig.getRequestId()!.equals(requestId)).toBe(true);
    expect(ethSig.getOrigin()).toBe('Satochip-Connect');
    expect(ethSig.getSignature().toString('hex')).toBe('11'.repeat(32) + '22'.repeat(32) + '1b');
  });

  it('encodes v minimally big-endian', () => {
    expect(encodeV(0).toString('hex')).toBe('00');
    expect(encodeV(1).toString('hex')).toBe('01');
    expect(encodeV(28).toString('hex')).toBe('1c');
    expect(encodeV(37).toString('hex')).toBe('25');
    // sepolia: 11155111 * 2 + 35 = 22310257
    expect(encodeV(22310257).toString('hex')).toBe('01546d71');
    expect(signatureBytes({ r: '0x01', s: '0x02', v: 0 }).length).toBe(65);
  });

  it('makeUR wraps raw cbor', () => {
    const ur = makeUR(Buffer.from('a0', 'hex'), 'eth-signature');
    expect(ur.cbor.toString('hex')).toBe('a0');
    expect(ethers.utils.isHexString('0x' + ur.cbor.toString('hex'))).toBe(true);
  });
});
