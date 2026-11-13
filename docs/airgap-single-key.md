# QR pairing for single-key accounts (ERC-4527 `crypto-account`)

Satodime vault accounts (and software accounts imported from a raw private
key) each hold **one** key pair.

> Software accounts created from a BIP39 mnemonic use `m/44'/60'/0'/0/i`, like
> Satochip: they pair with `ur:crypto-hdkey` (account-level xpub at
> `m/44'/60'/0'` + master fingerprint, recorded when the account is created or
> first unlocked) and are routed by fingerprint + full path. Only Satodime
> vaults and private-key software accounts use the scheme below.
They cannot be shared with browser extensions as an xpub (`ur:crypto-hdkey`):
MetaMask and Rabby always derive child keys from an xpub, and a child can never
equal its parent. They are shared as `ur:crypto-account` instead ("pubkey mode").

## Why 5 keys

- MetaMask (`@metamask/eth-qr-keyring`, `Device.addressFromIndex`) lists
  accounts in pages of 5 and throws `Address not found for index N` when fewer
  than 5 distinct addresses exist (it deduplicates by address).
- Keystone's `@keystonehq/base-eth-keyring` (Rabby, older MetaMask) rejects a
  `crypto-account` whose number of output descriptors is not a multiple of 5.
- Both take the device name from the **last** descriptor, so every descriptor
  carries the same name.

## Payload

For an account with compressed public key `P` and private key `k`:

| # | Public key | Path | Private key | Signed by the app |
|---|---|---|---|---|
| 1 | `P` | `m/44'/60'/0'/0/0` | `k` | yes |
| 2 | `2·P` | `m/44'/60'/0'/0/1` | `2k mod n` | **never** |
| 3 | `3·P` | `m/44'/60'/0'/0/2` | `3k mod n` | **never** |
| 4 | `4·P` | `m/44'/60'/0'/0/3` | `4k mod n` | **never** |
| 5 | `5·P` | `m/44'/60'/0'/0/4` | `5k mod n` | **never** |

- Master fingerprint = `RIPEMD160(SHA256(P_compressed))[0..4]`.
- Each output descriptor wraps a key-only `CryptoHDKey` (no chain code), with
  origin = the path above and source fingerprint = the master fingerprint,
  `name` = `Satodime #<vault> - use #1 only` or `SC Software - use #1 only`,
  `note` = `account.ledger_live` (the note Keystone devices put on their
  pubkey-mode ETH export).
- Paths are only identifiers: the app routes a sign request with
  fingerprint + last path index. Index 0 is signed normally. Indexes 1-4 are
  rejected right after the QR is decoded (`HELPER_ADDRESS_SELECTED`), before
  any review, PIN, password or NFC prompt.

Implementation: `src/airgap/singleKeyPayload.ts` (payload),
`src/airgap/accounts.ts` + `src/airgap/signRequest.ts` (routing).

## Recovering funds sent to a helper address (not implemented)

Helper `i` (index 1..4) belongs to the private key `a·k mod n` with `a = i + 1`,
so funds sent there by mistake remain recoverable with the account key:

- **Software key:** sign with `a·k mod n` directly.
- **Raw-hash signer that only holds `k` (Satodime card):** to sign digest `z`
  for key `a·k`, ask the card to sign `z' = z·a⁻¹ mod n`. The card returns
  `(r, s')`; the signature for `a·k` over `z` is `(r, s = s'·a mod n)`.
  Normalize `s` to low-S and recompute the recovery id against the helper
  address `a·P`.

  Proof sketch: with nonce `t`, `r = (t·G).x` and
  `s' = t⁻¹·(z·a⁻¹ + r·k)`, so `s'·a = t⁻¹·(z + r·a·k)`, which is an ECDSA
  signature of `z` by the key `a·k` with the same `r`.

This keeps a future "rescue funds" feature possible. The app must never sign
for helper keys in normal operation.
