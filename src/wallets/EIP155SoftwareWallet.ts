// Software wallet wrappers to implement the IWalletProvider interface
import {
  ISoftwareWallet,
  SensitiveInfo,
  SoftwareWalletInfo,
  WalletError,
  WalletErrorType,
  WalletType,
} from '@/types/WalletTypes.ts';
import { providers, utils, Wallet } from 'ethers';
import { WalletEncryptionService } from './WalletEncryptionService.ts';
// import wallet from '@reown/appkit-ui-react-native/src/assets/svg/Wallet.tsx';

export class EIP155SoftwareWallet implements ISoftwareWallet {
  public readonly type = WalletType.SOFTWARE;
  public readonly id: string;
  public readonly address: string;
  public readonly blockchain = 'eip155';
  public readonly softwareWalletInfo: SoftwareWalletInfo;

  private wallet: Wallet | undefined;
  private sensitiveInfo: SensitiveInfo | undefined;

  constructor(
    softwareWalletInfo: SoftwareWalletInfo,
    sensitiveInfo?: SensitiveInfo,
  ) {
    this.softwareWalletInfo = softwareWalletInfo;
    this.sensitiveInfo = sensitiveInfo;
    this.address = softwareWalletInfo.address;
    this.id = `software-${this.blockchain}-${this.address}`;

    if (sensitiveInfo) {
      this.setupWallet();
    }

    // todo: Connect to provider if provided
    // if (softwareWalletInfo.provider) {
    //   this.wallet = this.wallet.connect(softwareWalletInfo.provider);
    // }
  }

  public async unlockWallet(userPassword: string) {
    const encryptedBlob = this.softwareWalletInfo.encryptedBlob;
    this.sensitiveInfo = await WalletEncryptionService.decryptWithPassword(
      encryptedBlob,
      userPassword,
    );

    // setup wallet
    this.setupWallet();
  }

  public setupWallet() {
    if (!this.sensitiveInfo) {
      throw new Error(
        'Unable to setup software wallet, no key material found!',
      );
    }
    switch (this.sensitiveInfo.keyType) {
      case 'mnemonic':
        if (!this.sensitiveInfo.mnemonic) throw new Error('Mnemonic required');

        if (this.sensitiveInfo.passphrase) {
          const hdNode = utils.HDNode.fromMnemonic(
            this.sensitiveInfo.mnemonic,
            this.sensitiveInfo.passphrase,
          );
          this.wallet = new Wallet(hdNode);
        } else {
          this.wallet = Wallet.fromMnemonic(
            this.sensitiveInfo.mnemonic,
            this.sensitiveInfo.derivationPath || "m/44'/60'/0'/0/0",
          );
        }
        break;

      case 'privateKey':
        if (!this.sensitiveInfo.privateKey)
          throw new Error('Private key required');
        this.wallet = new Wallet(this.sensitiveInfo.privateKey);
        break;

      default:
        throw new Error('Invalid wallet type');
    }

    if (this.address !== this.wallet.address) {
      throw new Error(
        `Address mismatch during wallet unlock: expected ${this.address} but got ${this.wallet.address}`,
      );
    }
  }

  public getAddress(): string {
    return this.address;
  }

  public async signMessage(message: string | Uint8Array): Promise<string> {
    const messageStr =
      typeof message === 'string' ? message : Buffer.from(message).toString();
    if (!this.wallet) {
      throw new WalletError(WalletErrorType.WALLET_NOT_SET, "Wallet not set");
    }
    return await this.wallet.signMessage(messageStr);
  }

  public async signTransaction(transaction: any): Promise<string> {
    if (!this.wallet) {
      throw new WalletError(WalletErrorType.WALLET_NOT_SET, "Wallet not set");
    }
    return await this.wallet.signTransaction(transaction);
  }

  public async signTypedData(
    domain: any,
    types: any,
    data: any,
  ): Promise<string> {
    if (!this.wallet) {
      throw new WalletError(WalletErrorType.WALLET_NOT_SET, "Wallet not set");
    }
    return this.wallet._signTypedData(domain, types, data);
  }

  public connect(provider: providers.JsonRpcProvider) {
    if (!this.wallet) {
      throw new WalletError(WalletErrorType.WALLET_NOT_SET, "Wallet not set");
    }
    return this.wallet.connect(provider);
  }

  public async isAvailable(): Promise<boolean> {
    return (this.wallet!==undefined);
  }

  public getWalletInfo() {
    return this.softwareWalletInfo;
  }

  public getMnemonic(): string {
    if (!this.wallet) {
      throw new WalletError(WalletErrorType.WALLET_NOT_SET, "Wallet not set");
    }
    return this.wallet.mnemonic.phrase;
  }

  public exportPrivateKey(): string {
    if (!this.wallet) {
      throw new WalletError(WalletErrorType.WALLET_NOT_SET, "Wallet not set");
    }
    return this.wallet.privateKey;
  }
}