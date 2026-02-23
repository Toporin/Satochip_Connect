# Satochip-Connect: Privacy policy

This privacy statement applies to [Satochip-Connect](https://github.com/Toporin/Satochip_Connect) application.

Satochip-Connect is an open source app developed by [Satochip SRL](https://be.linkedin.com/company/satochip), based in Belgium.
The source code is available on GitHub under the GPL v3 license; the app is also available on Google Play and Apple Store.

At Satochip, we take privacy seriously and only process the information strictly necessary to provide the service intended to the users of our app.

## Personal Information

We DO NOT collect, store or use any personal information while you use this application.

## Third-party APIs

We employ third-party APIs and remote procedure calls (RPCs) in order to provide some services. 
The following data may be transmitted to these services in order to process the requests sent to them:

* Crypto address (for coins, tokens & NFTs stored on the Satochip)

This data is required to fetch information such as account balances, token and NFT metadata (name, description), and NFT image previews.

### Ethereum / EVM-compatible blockchain nodes
To retrieve account balances and token information for Ethereum and other EVM-compatible blockchains, 
the application communicates directly with remote blockchain nodes via JSON-RPC calls. 
Your wallet address is sent to these nodes as part of standard read-only requests (e.g. eth_getBalance, eth_call). 
No private keys or signing credentials are ever transmitted.

### WalletConnect v2

To enable the approval and signing of transaction requests from decentralized applications (dApps), 
the application integrates WalletConnect v2, developed by [Reown](https://reown.com). 
WalletConnect sessions are always initiated explicitly by the user and are never opened automatically by the application.

When a WalletConnect session is established, the following data may be relayed through Reown's infrastructure:

* Your wallet address(es)
* Transaction requests and associated parameters (e.g. recipient address, amount, contract interaction data)
* Session metadata (e.g. the name, URL, and description of the connected dApp)

WalletConnect v2 uses a relay server infrastructure to pass encrypted messages between your wallet and the connected dApp. 
The content of these messages is end-to-end encrypted and Reown's relay servers cannot read the transaction details. 
However, metadata such as IP addresses and session activity may be logged by Reown's infrastructure.

WalletConnect session credentials are stored locally on your device only and are never transmitted to or stored on any server controlled by us. 
Sessions persist until you explicitly disconnect them within the application.

For more information, please refer to [Reown's privacy policy](https://reown.com/privacy-policy).

## Links to Other Websites

The Satochip-Connect application may contain links to other sites. If you click on a third-party link, you will be directed to that site.
Note that these external sites are not operated by us. Therefore, we strongly advise you to review the Privacy Policy of these websites.
We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.

## Changes to our Privacy Policy

We may update our privacy policy from time to time. Thus, we advise you to review this page periodically for any changes.
We will notify you of any changes by posting the new privacy policy on this page. Any changes are effective immediately after they are posted on this page.

This policy is effective as of 2026-02-01.

## How to contact us

If you have any questions or suggestions about our privacy policy, you can contact us at support(at)satochip.io.