# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7]

Add support for Satodime cards (v0.2-0.1 or later). Update Satochip-React-native library to v0.1.8:
* Add a Satodime vault (Ethereum or Polygon, mainnet or testnet) as an account; Bitcoin-family vaults are shown as unsupported
* Sign transactions, messages and EIP-712 data on the card (WalletConnect, Send and QR signing); no PIN
* The unlock code is obtained when signing: code engraved on the card (CVC), claim of a card without owner, or the code stored by this app
* Sealed vaults are unsealed by the app, with the user's permission, before the first signature
* Release ownership of a card owned by this app; the last account of such a card can only be deleted after release
* Card unlock codes are kept in the device secure storage (Keychain / Keystore)

Connect to browser extensions (MetaMask, Rabby...) with QR codes (ERC-4527):
* Pair Satochip and software accounts (xpub), and Satodime vaults (single key: use only the first of the 5 addresses shown)
* Scan sign requests, review them, sign, and show the signature as an animated QR code
* Requests for helper addresses of Satodime vaults are rejected before any PIN or NFC prompt

Accounts:
* When several accounts share an address (e.g. a software account restored from a Satochip seed), the user chooses the account that signs
* Fix software accounts using a BIP39 passphrase (the key was not derived at the account path)
* Fix the address preview when adding a Satochip account, and the account index after deleting an account
* Account list and details show the account type (Satochip, Satodime or Software)

UI fixes:
* Buttons, toasts and the NFC prompt are no longer hidden behind the Android navigation and status bars (Android 15+ edge-to-edge)
* WalletConnect connection: explain why Approve needs a selected address
* "Explore" and NFT links open in the browser again on Android 11+

Dev: update Metro to 0.83.8 (fixes missing scaled image assets); add react-native-keychain (run `pod install` on iOS).

## [0.1.6]

Add support for Satochip applet v0.16 cards. Update Satochip-React-native library to v0.1.7:
* Raise the Android NFC transceive timeout to 5 s (v0.16 cards need ~1.1 s to initiate the secure channel)
* Parse the authentikey coordx returned by v0.16 cards when initiating the secure channel
* Check the authentikey of legacy (pre-v0.16) cards

Dev: Metro no longer watches the Android/iOS build folders (fixes a Metro crash during builds without watchman).

## [0.1.5]

Update Satochip-React-native library t0 v0.1.4 (patch pubkey recovery bug).

## [0.1.4]

* Add support for ERC20 and NFT display
* Using Alchemy API
* Currently support Token for Ethereum, Binance Smart Chain, Polygon, Arbitrum One, Base, Avalanche, Optimism, Celo, zkSync, Eth Sepolia testnet
* Currently support NFTs for Ethereum, Binance Smart Chain & Polygon

## [0.1.3]

* Disable Sentry
* Improve project build config (versioning, android build)
* Add privacy policy

## [0.1.2]

* Fix: Account deletion crash due to React Hooks violation

## [0.1.1]

* Update EIP155 RPCs
* Improve app logging
* Fix: sendTransaction: check that amount is still valid after gasLimit update
* Update getSupportedChainIds() to use EIP155_CHAINS instead of EIP155_RPCS_BY_CHAINS
* UX: improve chain selection in SendTransaction screen
* Patch a bug in chainId format

## [0.1.0]

* initial version