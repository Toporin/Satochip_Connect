/**
 * Test helpers: a deterministic "Satochip card" mock backed by an ethers HDNode.
 */
import { ethers } from 'ethers';
import type { AirgapAccount } from '../../src/airgap/signRequest';

export const TEST_MNEMONIC =
  'test test test test test test test test test test test junk';

export const CURVE_N = ethers.BigNumber.from(
  '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
);

export const root = ethers.utils.HDNode.fromMnemonic(TEST_MNEMONIC);
export const accountNode = root.derivePath("m/44'/60'/0'");
export const masterXfp = root.fingerprint.slice(2).toUpperCase();
export const xpub = accountNode.neuter().extendedKey;

export function accountInfo(i: number): AirgapAccount & { xpub: string } {
  const node = accountNode.derivePath(`0/${i}`);
  return {
    id: `satochip-eip155-${masterXfp}-m/44'/60'/0'/0/${i}`,
    name: `Test ${i}`,
    address: node.address,
    masterXfp,
    derivationPath: `m/44'/60'/0'/0/${i}`,
    xpub,
  };
}

function derInt(hex: string): Buffer {
  let b = Buffer.from(ethers.utils.stripZeros(hex));
  if (b.length === 0) {
    b = Buffer.from([0]);
  }
  if (b[0] >= 0x80) {
    b = Buffer.concat([Buffer.from([0]), b]);
  }
  return Buffer.concat([Buffer.from([0x02, b.length]), b]);
}

export function toDER(r: string, s: string): Buffer {
  const body = Buffer.concat([derInt(r), derInt(s)]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

/**
 * Mock card: sign `hash` with the key at `path` and return a DER signature.
 * When `highS` is true the (still valid) high-s variant is returned, like a
 * card that does not normalize s.
 */
export function mockCardSign(path: string, hash: string, highS = false): Buffer {
  const node = root.derivePath(path);
  const sig = new ethers.utils.SigningKey(node.privateKey).signDigest(hash);
  let s = sig.s;
  if (highS) {
    s = ethers.utils.hexZeroPad(CURVE_N.sub(sig.s).toHexString(), 32);
  }
  return toDER(sig.r, s);
}
