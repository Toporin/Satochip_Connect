# Satochip-Connect

## About

Satochip-Connect is a React Native mobile wallet application that supports WalletConnect integration for both software and Satochip hardware wallets.

### Key Features

- **WalletConnect/Reown Integration**: Connect to decentralized applications (dApps) using the WalletConnect protocol
- **Multiple Wallet Types**:
  - Software wallets based on BIP39 mnemonics with encrypted storage
  - Hardware wallet support via Satochip NFC cards
- **Transaction Signing**: Support for EIP-155 transaction signing and message signing
- **Multi-Account Management**: Create and manage multiple accounts across different wallet types
- **WalletConnect Features**:
  - Session proposals and approvals
  - Transaction signing requests
  - Message signing (personal_sign, eth_signTypedData)
  - Session authentication

### Technology Stack

- React Native 0.82.0
- @reown/walletkit for WalletConnect protocol
- ethers.js for Ethereum operations
- Valtio for state management
- react-native-nfc-manager for hardware wallet communication
- react-native-mmkv for secure local storage

### Use Cases

This wallet is ideal for:
- Understanding WalletConnect integration in React Native
- Learning how to implement hardware wallet support via NFC
- Building production-ready mobile wallet applications
- Testing dApp interactions with WalletConnect

## Getting Started

>**Note**: Make sure you have completed the [React Native - Environment Setup](https://reactnative.dev/docs/environment-setup) instructions till "Creating a new application" step, before proceeding.

### iOS setup

Install node & nvm

```
brew install nvm
# Follow the post-install instructions to add nvm to your shell profile
nvm install --lts
nvm use --lts
```

Add the following to your shell profile e.g. ~/.profile or ~/.zshrc:
```
  export NVM_DIR="$HOME/.nvm"
  [ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh"  # This loads nvm
  [ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/usr/local/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion
```

Use corepack to  manage yarn:
```
corepack enable
```

Install CocoaPods:
```
brew install cocoapods
```

Install Xcode from the App Store (if you haven't already) then switch xcode-select to use the full Xcode app:
```
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```


### Step 1: Install Dependencies

```bash
yarn install
```

### Step 2: Create mocked google-service files
In order to build the app successfuly, you'll need some extra files

```bash
chmod +x ./scripts/copy-sample-files.sh && ./scripts/copy-sample-files.sh
```

### Step 3: Add your Reown Cloud Project ID

Open .env.debug file and replace **ENV_PROJECT_ID with your [Cloud Project ID](https://cloud.reown.com/).


### Step 4: Start your Application

Let Metro Bundler run in its _own_ terminal. Open a _new_ terminal from the _root_ of your React Native project. Run the following command to start your _Android_ or _iOS_ app:

#### For Android

```bash
yarn android
```

#### For iOS

```bash
cd ios && pod install
yarn ios
```

If everything is set up _correctly_, you should see your new app running in your _Android Emulator_ or _iOS Simulator_ shortly.

To list your devices:
```
xcrun xctrace list devices
```

This is one way to run your app — you can also run it directly from within Android Studio and Xcode respectively.

### Step 5: Build APK

#### Update app version

For Android, update app version in `./android/app/build.gradle` using semantic versioning: versionName & versionCode.

For iOS, update app version in ./ios/RNWeb3Wallet.xcodeproj: MARKETING_VERSION & CURRENT_PROJECT_VERSION:
Using a script on MacOS:
```bash
sed -i '' 's/MARKETING_VERSION = .*/MARKETING_VERSION = 0.1.0;/' ios/RNWeb3Wallet.xcodeproj/project.pbxproj
sed -i '' 's/CURRENT_PROJECT_VERSION = .*/CURRENT_PROJECT_VERSION = 100;/' ios/RNWeb3Wallet.xcodeproj/project.pbxproj
```
On linux, use:
```bash
sed -i 's/MARKETING_VERSION = .*/MARKETING_VERSION = 0.1.0;/' ios/RNWeb3Wallet.xcodeproj/project.pbxproj
sed -i 's/CURRENT_PROJECT_VERSION = .*/CURRENT_PROJECT_VERSION = 100;/' ios/RNWeb3Wallet.xcodeproj/project.pbxproj
```

#### Build debug APK: 
```bash
yarn build-android-debug
cd android
./gradlew clean
./gradlew assembleDebug
```

## Acknowledgement

This application is based on the [RNWeb3Wallet](https://github.com/reown-com/react-native-examples/tree/main/wallets/rn_cli_wallet).