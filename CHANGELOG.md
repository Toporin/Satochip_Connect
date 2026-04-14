# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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