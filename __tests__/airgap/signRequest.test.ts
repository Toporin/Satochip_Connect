/**
 * @jest-environment node
 */
import { ethers } from 'ethers';
import { EthSignRequest, DataType } from '@keystonehq/bc-ur-registry-eth';

import {
  AirgapError,
  hashTypedDataV4,
  normalizePath,
  parseSignRequestCBOR,
  parseSignRequestUR,
} from '../../src/airgap/signRequest';
import { finalizeSignature } from '../../src/airgap/signing';
import { accountInfo, masterXfp, mockCardSign } from './helpers';

const accounts = [0, 1].map(accountInfo);
const PATH0 = "m/44'/60'/0'/0/0";
const REQUEST_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

function request(
  signData: Buffer,
  dataType: DataType,
  opts: { path?: string; xfp?: string; chainId?: number; address?: string } = {},
): Buffer {
  return EthSignRequest.constructETHRequest(
    signData,
    dataType,
    opts.path ?? PATH0,
    opts.xfp ?? masterXfp,
    REQUEST_ID,
    opts.chainId,
    opts.address,
    'test',
  ).toCBOR();
}

function expectAirgapError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AirgapError);
    expect((e as AirgapError).code).toBe(code);
    return;
  }
  throw new Error(`expected AirgapError ${code}`);
}

// EIP-155 spec example: nonce 9, 20 gwei, 21000 gas, to 0x3535..35, 1 ETH, chainId 1
const EIP155_SIGNING_DATA =
  '0xec098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a764000080018080';
const EIP155_SIGNING_HASH = '0xdaf5a779ae972f972197303d7b574746c7ef83eadac0f2791ad23db92e4c8e53';

// EIP-712 spec "Mail" example
const MAIL_TYPED_DATA = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    from: { name: 'Cow', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
    to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
    contents: 'Hello, Bob!',
  },
};
const MAIL_DIGEST = '0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2';

describe('hashing', () => {
  it('legacy tx: keccak256 of the EIP-155 signing data (EIP-155 vector)', () => {
    const parsed = parseSignRequestCBOR(
      request(Buffer.from(EIP155_SIGNING_DATA.slice(2), 'hex'), DataType.transaction, { chainId: 1 }),
      accounts,
    );
    expect(parsed.hash).toBe(EIP155_SIGNING_HASH);
    expect(parsed.chainId).toBe(1);
    expect(parsed.txType).toBe(0);
    expect(parsed.requestIdString).toBe(REQUEST_ID);
    expect(parsed.origin).toBe('test');
    const fields = Object.fromEntries(parsed.display.fields.map(f => [f.label, f.value]));
    expect(fields.To).toBe('0x3535353535353535353535353535353535353535');
    expect(fields.Value).toBe('1.0 ETH');
    expect(fields.Nonce).toBe('9');
    expect(fields['Gas price']).toBe('20.0 gwei');
  });

  it('EIP-1559 tx: keccak256 of the exact bytes', () => {
    const unsigned = ethers.utils.serializeTransaction({
      type: 2,
      chainId: 137,
      nonce: 5,
      maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'),
      maxFeePerGas: ethers.utils.parseUnits('100', 'gwei'),
      gasLimit: 65000,
      to: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      value: 0,
      data: new ethers.utils.Interface(['function transfer(address,uint256)']).encodeFunctionData('transfer', [
        accounts[1].address,
        1000000,
      ]),
    });
    const parsed = parseSignRequestCBOR(
      request(Buffer.from(unsigned.slice(2), 'hex'), DataType.typedTransaction, { chainId: 137 }),
      accounts,
    );
    expect(parsed.hash).toBe(ethers.utils.keccak256(unsigned));
    expect(parsed.txType).toBe(2);
    expect(parsed.display.undecodable).toBe(false);
    const fields = Object.fromEntries(parsed.display.fields.map(f => [f.label, f.value]));
    expect(fields.Function).toBe('transfer(address,uint256)');
    expect(fields.to).toBe(accounts[1].address);
    expect(fields.amount).toBe('1000000');
    expect(fields['Max fee per gas']).toBe('100.0 gwei');
  });

  it('EIP-2930 (type 1) tx is accepted', () => {
    const unsigned = ethers.utils.serializeTransaction({
      type: 1,
      chainId: 1,
      nonce: 0,
      gasPrice: 1,
      gasLimit: 21000,
      to: accounts[1].address,
      value: 1,
      accessList: [],
    });
    const parsed = parseSignRequestCBOR(
      request(Buffer.from(unsigned.slice(2), 'hex'), DataType.typedTransaction),
      accounts,
    );
    expect(parsed.hash).toBe(ethers.utils.keccak256(unsigned));
    expect(parsed.txType).toBe(1);
    expect(parsed.chainId).toBe(1);
  });

  it('EIP-7702 (type 4) tx is accepted, hashed raw and flagged', () => {
    const auth = [
      '0x01',
      '0x' + '22'.repeat(20),
      '0x',
      '0x01',
      '0x' + '33'.repeat(32),
      '0x' + '44'.repeat(32),
    ];
    const payload = ethers.utils.RLP.encode([
      '0x01', // chainId
      '0x', // nonce
      '0x01',
      '0x02',
      '0x5208',
      accounts[0].address.toLowerCase(),
      '0x',
      '0x',
      [],
      [auth],
    ]);
    const bytes = ethers.utils.concat(['0x04', payload]);
    const parsed = parseSignRequestCBOR(
      request(Buffer.from(bytes), DataType.typedTransaction, { chainId: 1 }),
      accounts,
    );
    expect(parsed.hash).toBe(ethers.utils.keccak256(bytes));
    expect(parsed.txType).toBe(4);
    expect(parsed.display.warnings.join(' ')).toMatch(/EIP-7702/);
  });

  it('personal message: EIP-191 hash, printable text shown', () => {
    const parsed = parseSignRequestCBOR(
      request(Buffer.from('hello world'), DataType.personalMessage, { address: accounts[0].address }),
      accounts,
    );
    expect(parsed.hash).toBe('0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68');
    expect(parsed.display.body).toBe('hello world');
    expect(parsed.display.undecodable).toBe(false);
  });

  it('personal message: binary data shown as hex and flagged', () => {
    const data = Buffer.from('00ff'.repeat(16), 'hex');
    const parsed = parseSignRequestCBOR(request(data, DataType.personalMessage), accounts);
    expect(parsed.hash).toBe(ethers.utils.hashMessage(data));
    expect(parsed.display.body).toBe('0x' + data.toString('hex'));
    expect(parsed.display.undecodable).toBe(true);
    expect(parsed.display.warnings.join(' ')).toMatch(/32-byte hash/);
  });

  it('typed data: EIP-712 spec Mail vector', () => {
    expect(hashTypedDataV4(MAIL_TYPED_DATA as any)).toBe(MAIL_DIGEST);
    const parsed = parseSignRequestCBOR(
      request(Buffer.from(JSON.stringify(MAIL_TYPED_DATA)), DataType.typedData, { address: accounts[0].address }),
      accounts,
    );
    expect(parsed.hash).toBe(MAIL_DIGEST);
    const fields = Object.fromEntries(parsed.display.fields.map(f => [f.label, f.value]));
    expect(fields['Domain name']).toBe('Ether Mail');
    expect(fields['Primary type']).toBe('Mail');
  });

  it('typed data: unused types are ignored (eth-sig-util behaviour)', () => {
    const withExtra = {
      ...MAIL_TYPED_DATA,
      types: { ...MAIL_TYPED_DATA.types, Unused: [{ name: 'x', type: 'uint256' }] },
    };
    const parsed = parseSignRequestCBOR(
      request(Buffer.from(JSON.stringify(withExtra)), DataType.typedData),
      accounts,
    );
    expect(parsed.hash).toBe(MAIL_DIGEST);
  });

  it('signature over each hash recovers to the account (with v format)', async () => {
    const cases: Array<[Buffer, DataType, number | undefined, (v: number) => boolean]> = [
      [Buffer.from(EIP155_SIGNING_DATA.slice(2), 'hex'), DataType.transaction, 1, v => v === 37 || v === 38],
      [Buffer.from('hi'), DataType.personalMessage, undefined, v => v === 27 || v === 28],
      [Buffer.from(JSON.stringify(MAIL_TYPED_DATA)), DataType.typedData, undefined, v => v === 27 || v === 28],
    ];
    for (const [data, type, chainId, vOk] of cases) {
      for (const highS of [false, true]) {
        const parsed = parseSignRequestCBOR(request(data, type, { chainId }), accounts);
        const der = mockCardSign(PATH0, parsed.hash, highS);
        const sig = await finalizeSignature(parsed.hash, der, accounts[0].address, parsed.dataType, parsed.chainId);
        expect(vOk(sig.v)).toBe(true);
        expect(ethers.BigNumber.from(sig.s).lte('0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0')).toBe(true);
        expect(ethers.utils.recoverAddress(parsed.hash, sig)).toBe(accounts[0].address);
      }
    }
  });

  it('finalizeSignature rejects a signature from another key', async () => {
    const hash = ethers.utils.keccak256('0x01');
    const der = mockCardSign("m/44'/60'/0'/0/1", hash);
    await expect(
      finalizeSignature(hash, der, accounts[0].address, DataType.personalMessage as any),
    ).rejects.toThrow();
  });
});

describe('validation', () => {
  const msg = Buffer.from('hello');

  it('wrong xfp', () => {
    expectAirgapError(() => parseSignRequestCBOR(request(msg, DataType.personalMessage, { xfp: 'deadbeef' }), accounts), 'WRONG_WALLET');
  });

  it('unknown path', () => {
    expectAirgapError(
      () => parseSignRequestCBOR(request(msg, DataType.personalMessage, { path: "m/44'/60'/0'/0/7" }), accounts),
      'UNKNOWN_PATH',
    );
    expectAirgapError(
      () => parseSignRequestCBOR(request(msg, DataType.personalMessage, { path: "m/44'/60'/1'/0/0" }), accounts),
      'UNKNOWN_PATH',
    );
  });

  it('address mismatch', () => {
    expectAirgapError(
      () => parseSignRequestCBOR(request(msg, DataType.personalMessage, { address: accounts[1].address }), accounts),
      'ADDRESS_MISMATCH',
    );
  });

  it('matches the second account by path', () => {
    const parsed = parseSignRequestCBOR(
      request(msg, DataType.personalMessage, { path: "m/44'/60'/0'/0/1", address: accounts[1].address }),
      accounts,
    );
    expect(parsed.account.address).toBe(accounts[1].address);
  });

  it('chain id mismatch (legacy and typed)', () => {
    expectAirgapError(
      () =>
        parseSignRequestCBOR(
          request(Buffer.from(EIP155_SIGNING_DATA.slice(2), 'hex'), DataType.transaction, { chainId: 5 }),
          accounts,
        ),
      'CHAIN_MISMATCH',
    );
    const unsigned = ethers.utils.serializeTransaction({ type: 2, chainId: 1, nonce: 0, maxFeePerGas: 1, maxPriorityFeePerGas: 1, gasLimit: 21000, to: accounts[1].address });
    expectAirgapError(
      () =>
        parseSignRequestCBOR(
          request(Buffer.from(unsigned.slice(2), 'hex'), DataType.typedTransaction, { chainId: 10 }),
          accounts,
        ),
      'CHAIN_MISMATCH',
    );
  });

  it('bad CBOR', () => {
    expectAirgapError(() => parseSignRequestCBOR(Buffer.from('ffffff', 'hex'), accounts), 'MALFORMED');
    expectAirgapError(() => parseSignRequestCBOR(Buffer.from('a0', 'hex'), accounts), 'MALFORMED');
  });

  it('wrong UR type', () => {
    expectAirgapError(() => parseSignRequestUR({ type: 'crypto-psbt', cbor: Buffer.from('a0', 'hex') }, accounts), 'WRONG_UR_TYPE');
  });

  it('unsupported data / tx types', () => {
    expectAirgapError(() => parseSignRequestCBOR(request(msg, 9 as DataType), accounts), 'UNSUPPORTED_TYPE');
    const blob = Buffer.concat([Buffer.from([3]), Buffer.from(ethers.utils.arrayify(ethers.utils.RLP.encode(['0x01'])))]);
    expectAirgapError(() => parseSignRequestCBOR(request(blob, DataType.typedTransaction), accounts), 'UNSUPPORTED_TYPE');
    const preEip155 = Buffer.from(ethers.utils.arrayify(ethers.utils.RLP.encode(['0x', '0x01', '0x5208', accounts[1].address, '0x', '0x'])));
    expectAirgapError(() => parseSignRequestCBOR(request(preEip155, DataType.transaction), accounts), 'UNSUPPORTED_TYPE');
  });

  it('malformed transaction / typed data', () => {
    expectAirgapError(() => parseSignRequestCBOR(request(Buffer.from('c0', 'hex'), DataType.transaction), accounts), 'MALFORMED');
    expectAirgapError(() => parseSignRequestCBOR(request(Buffer.from('not json'), DataType.typedData), accounts), 'MALFORMED');
    expectAirgapError(
      () => parseSignRequestCBOR(request(Buffer.from(JSON.stringify({ types: {}, domain: {}, primaryType: 'X', message: {} })), DataType.typedData), accounts),
      'MALFORMED',
    );
  });

  it('flags unknown calldata and unlimited approvals', () => {
    const unknownCall = ethers.utils.serializeTransaction({ type: 2, chainId: 1, nonce: 0, maxFeePerGas: 1, maxPriorityFeePerGas: 1, gasLimit: 100000, to: accounts[1].address, data: '0x12345678deadbeef' });
    const p1 = parseSignRequestCBOR(request(Buffer.from(unknownCall.slice(2), 'hex'), DataType.typedTransaction), accounts);
    expect(p1.display.undecodable).toBe(true);
    const approve = new ethers.utils.Interface(['function approve(address,uint256)']).encodeFunctionData('approve', [accounts[1].address, ethers.constants.MaxUint256]);
    const approveTx = ethers.utils.serializeTransaction({ type: 2, chainId: 1, nonce: 0, maxFeePerGas: 1, maxPriorityFeePerGas: 1, gasLimit: 100000, to: accounts[1].address, data: approve });
    const p2 = parseSignRequestCBOR(request(Buffer.from(approveTx.slice(2), 'hex'), DataType.typedTransaction), accounts);
    expect(p2.display.undecodable).toBe(false);
    expect(p2.display.warnings.join(' ')).toMatch(/UNLIMITED/);
  });

  it('normalizes paths', () => {
    expect(normalizePath("m/44'/60'/0'/0/0")).toBe("44'/60'/0'/0/0");
    expect(normalizePath('44h/60h/0h/0/0')).toBe("44'/60'/0'/0/0");
    expect(normalizePath("M/44'/60'/0'/0/0/")).toBe("44'/60'/0'/0/0");
  });
});
