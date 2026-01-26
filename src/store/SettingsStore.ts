import { proxy } from 'valtio';
import { SessionTypes, Verify } from '@walletconnect/types';

import { storage } from '@/utils/storage';
import {
  ISatochipWallet,
  ISoftwareWallet,
  IWalletProvider,
  SatochipInfo,
  SensitiveInfo,
  SoftwareWalletInfo,
  WalletType,
} from '@/types/WalletTypes';
import { SatochipWallet } from '@/wallets/satochip/SatochipWallet';
import { EIP155SoftwareWallet } from '@/wallets/EIP155SoftwareWallet';
import type { BalanceEntry } from '@/services/BalanceService';

/**
 * Types
 */
interface State {
  relayerRegionURL: string;
  currentRequestVerifyContext?: Verify.Context;
  sessions: SessionTypes.Struct[];
  initPromise?: Promise<void>;
  initPromiseResolver?: {
    resolve: (value: undefined) => void;
    reject: (reason?: unknown) => void;
  };
  socketStatus: 'connected' | 'disconnected' | 'stalled' | 'unknown';
  logs: string[];
  appLogs: string[]; // Application logs (separate from WalletConnect logs)
  isLinkModeRequest: boolean; // todo: purpose?

  // Wallet management
  wallets: Map<string, IWalletProvider>;
  activeWalletId: string | null;

  // Balance management (in-memory only, no persistence)
  balances: Record<string, BalanceEntry>; // Key format: "address:chainId"
  balancesLoading: boolean;
  balancesError: string | null;
  lastBalanceFetch: number | null; // Timestamp for deduplication
}

/**
 * State
 */
const state = proxy<State>({
  relayerRegionURL: '',
  sessions: [],
  socketStatus: 'unknown',
  logs: [],
  appLogs: [],
  isLinkModeRequest: false,

  // Wallet management
  wallets: new Map(),
  activeWalletId: null,

  // Balance management
  balances: {},
  balancesLoading: false,
  balancesError: null,
  lastBalanceFetch: null,
});

/**
 * Store / Actions
 */
const SettingsStore = {
  state,

  setCurrentRequestVerifyContext(context?: Verify.Context) {
    state.currentRequestVerifyContext = context;
  },

  setSessions(sessions: SessionTypes.Struct[]) {
    state.sessions = sessions;
  },

  setInitPromise() {
    state.initPromise = new Promise((resolve, reject) => {
      state.initPromiseResolver = {resolve, reject};
    });
  },

  setSocketStatus(value: State['socketStatus']) {
    state.socketStatus = value;
  },

  setLogs(logs: string[]) {
    state.logs = logs;
  },

  setAppLogs(logs: string[]) {
    state.appLogs = logs;
  },

  addAppLog(log: string) {
    // Prepend new log (newest first)
    if (state.appLogs.length >= 500) {
      state.appLogs = [log, ...state.appLogs.slice(0, 499)];
    } else {
      state.appLogs = [log, ...state.appLogs];
    }
  },

  clearAppLogs() {
    state.appLogs = [];
  },

  setIsLinkModeRequest(value: State['isLinkModeRequest']) {
    state.isLinkModeRequest = value;
  },

  // Wallet management actions
  addWallet(wallet: IWalletProvider) {
    // Create a new Map to trigger reactivity
    const newWallets = new Map(state.wallets);
    newWallets.set(wallet.id, wallet);
    state.wallets = newWallets;
  },

  removeWallet(walletId: string) {
    const wallet = state.wallets.get(walletId);
    if (wallet) {
      // Create a new Map to trigger reactivity
      const newWallets = new Map(state.wallets);
      newWallets.delete(walletId);
      state.wallets = newWallets;

      // update active wallet if needed
      if (state.activeWalletId === walletId) {
        state.activeWalletId = null;
      }

      // remove wallet from persistent memory
      if (wallet.type === WalletType.SOFTWARE){
        this.saveSoftwareWallets();
      } else if (wallet.type === WalletType.SATOCHIP){
        this.saveSatochipWallets();
      }
    }
  },

  setActiveWallet(walletId: string | null) {
    state.activeWalletId = walletId;
  },

  getWallet(walletId: string): IWalletProvider | undefined {
    return state.wallets.get(walletId);
  },

  getActiveWallet(): IWalletProvider | undefined {
    return state.activeWalletId ? state.wallets.get(state.activeWalletId) : undefined;
  },

  getWalletByAddress(address: string): IWalletProvider | undefined {
    for (const [_id, wallet] of state.wallets) {
      if (wallet.address.toLowerCase() === address.toLowerCase()) {
        return wallet;
      }
    }
    return undefined;
  },

  getAllWallets(): IWalletProvider[] {
    return Array.from(state.wallets.values());
  },

  /**
   * Get software wallets
   */
  getSoftwareWallets(): ISoftwareWallet[] {
    return Array.from(state.wallets.values())
      .filter(wallet => wallet.type === WalletType.SOFTWARE) as ISoftwareWallet[];
  },

  getSatochipWallets(): ISatochipWallet[] {
    return Array.from(state.wallets.values())
      .filter(wallet => wallet.type === WalletType.SATOCHIP) as ISatochipWallet[];
  },

  /**
   * Save SatochipWallet in persistent memory by saving the SatochipInfo from each SatochipWallet
   */
  async saveSatochipWallets() {
    try {
      const satochipWallets = this.getSatochipWallets();
      const satochipInfos =  satochipWallets.map(wallet => wallet.satochipInfo);
      await storage.setItem('SATOCHIP_CARDS', JSON.stringify(satochipInfos));
      console.log(`Saved ${satochipInfos.length} satochip wallets to persistent memory`);
    } catch (error) {
      console.error('Failed to save Satochip cards:', error);
    }
  },

  /**
   * load SatochipInfo from persistent memory then recover SatochipWallets from that
   */
  async loadSatochipWallets() {
    try {
      const cardsJson = await storage.getItem('SATOCHIP_CARDS');
      // console.log('loadSatochipCards cardsJson:', cardsJson);
      // console.log(JSON.stringify(cardsJson, null, 2));
      if (cardsJson) {
        // cardsJson is already an array, no need to parse
        const satochipInfos = cardsJson as SatochipInfo[];
        for (const satochipInfo of satochipInfos) {
          this.createSatochipWallet(satochipInfo);
        }
        console.log(`Loaded ${satochipInfos.length} Satochip wallets from persistent memory to store`)
      }
    } catch (error) {
      console.error('Failed to load Satochip cards:', error);
    }
  },

  /**
   * Create a Satochip hardware wallet
   * Moved from WalletFactory to consolidate wallet management
   */
  createSatochipWallet(satochipInfo: SatochipInfo): ISatochipWallet | undefined {
    try {
      // console.log(`Creating Satochip wallet for id: ${satochipInfo.id}`);

      const wallet = new SatochipWallet(satochipInfo);

      // Store the wallet in the centralized wallet store
      this.addWallet(wallet);

      // Backup wallets in persistent memory
      this.saveSatochipWallets();

      return wallet;
    } catch (error) {
      console.error('Error creating Satochip wallet:', error);
      // todo: user notification + do something else?
    }
  },

  /**
   * Create a software wallet
   * Moved from WalletFactory to consolidate wallet management
   * todo: refactor metho args using SoftwareWalletInfo instead of params
   */
   createSoftwareWallet(softwareWalletInfo: SoftwareWalletInfo, sensitiveInfo?: SensitiveInfo): ISoftwareWallet | undefined {
    try {

      let wallet: ISoftwareWallet = new EIP155SoftwareWallet(softwareWalletInfo, sensitiveInfo);

      // Store the wallet in the centralized wallet store
      this.addWallet(wallet);

      // Backup wallets in persistent memory
      this.saveSoftwareWallets();

      return wallet;
    } catch (error) {
      console.error('Error creating software wallet:', error);
      // todo: user notification + do something else?
    }
  },

  /**
   * Save softwareWallets in persistent memory by saving the softwareWalletInfo from each softwareWallet
   * Sensitive info like mnemonic & passphrase is NOT saved in persistent memory (only an encryptedBlob).
   */
  async saveSoftwareWallets() {
    try {
      const softwareWallets = this.getSoftwareWallets();
      const softwareWalletInfos =  softwareWallets.map(wallet => wallet.softwareWalletInfo);
      await storage.setItem('SOFTWARE_WALLET_INFOS', JSON.stringify(softwareWalletInfos));
      console.log(`Saved ${softwareWalletInfos.length} software wallets to persistent memory`);
    } catch (error) {
      console.error('Failed to save software wallets: ', error);
    }
  },

  /**
   * load softwareWalletInfos from persistent memory then recover softwareWallets from that
   * Wallet is still locked at this point since user password is required to recover sensitive info such as mnemonic from encryptedBlob.
   * User password is requested when needed.
   */
  async loadSoftwareWallets() {
    try {
      const infosJson = await storage.getItem('SOFTWARE_WALLET_INFOS');
      // console.log('loadSoftwareWallets infosJson:', infosJson);
      // console.log(JSON.stringify(infosJson, null, 2));
      if (infosJson) {
        // infosJson is already an array, no need to parse
        const softwareWalletInfos = infosJson as SoftwareWalletInfo[];
        for (const softwareWalletInfo of softwareWalletInfos) {
          this.createSoftwareWallet(softwareWalletInfo);
        }
        console.log(`Loaded ${softwareWalletInfos.length} software wallets from persistent memory to store`)
      }
    } catch (error) {
      console.error('Failed to load softwareWalletInfos:', error);
    }
  },

  /**
   * Clear all wallets (useful for testing)
   * Moved from WalletFactory to consolidate wallet management
   */
  async clearAllWallets(): Promise<void> {
    state.wallets.clear();
    state.activeWalletId = null;
    console.log('All wallets cleared');
  },

  /**
   * Get all available wallets for a specific blockchain
   * Replaces WalletProviderUtil.getWalletsForBlockchain()
   */
  getWalletsForBlockchain(blockchain: string): IWalletProvider[] {
    const allWallets = this.getAllWallets();
    return allWallets.filter(
      wallet =>
        wallet.blockchain === blockchain ||
        (blockchain === 'ethereum' && wallet.blockchain === 'eip155'),
    );
  },

  /**
   * Get all available addresses for a specific blockchain
   * Replaces WalletProviderUtil.getAddressesForBlockchain()
   */
  getAddressesForBlockchain(blockchain: string): string[] {
    const wallets = this.getWalletsForBlockchain(blockchain);
    return wallets.map(wallet => wallet.address);
  },

  // ============================================
  // Balance Management Methods
  // ============================================

  /**
   * Set loading state for balance fetching
   */
  setBalancesLoading(loading: boolean) {
    state.balancesLoading = loading;
  },

  /**
   * Set error state for balance fetching
   */
  setBalancesError(error: string | null) {
    state.balancesError = error;
  },

  /**
   * Update balance for a specific address and chain
   */
  updateBalance(address: string, chainId: number, entry: BalanceEntry) {
    const key = `${address}:${chainId}`;
    state.balances = {
      ...state.balances,
      [key]: entry,
    };
  },

  /**
   * Update multiple balances at once
   */
  updateBalances(balances: Record<string, BalanceEntry>) {
    state.balances = {
      ...state.balances,
      ...balances,
    };
  },

  /**
   * Get balance for a specific address and chain
   */
  getBalance(address: string, chainId: number): BalanceEntry | undefined {
    const key = `${address}:${chainId}`;
    return state.balances[key];
  },

  /**
   * Get all balances for a specific address across all chains
   */
  getBalancesForAddress(address: string): BalanceEntry[] {
    const balances: BalanceEntry[] = [];
    for (const [key, entry] of Object.entries(state.balances)) {
      if (key.startsWith(`${address}:`)) {
        balances.push(entry);
      }
    }
    return balances;
  },

  /**
   * Get all non-zero balances for a specific address
   */
  getNonZeroBalancesForAddress(address: string): BalanceEntry[] {
    return this.getBalancesForAddress(address).filter(
      entry => entry.balance !== '0' && !entry.error
    );
  },

  /**
   * Clear all balances (useful for logout or refresh)
   */
  clearBalances() {
    state.balances = {};
    state.balancesLoading = false;
    state.balancesError = null;
    state.lastBalanceFetch = null;
  },

  /**
   * Set last balance fetch timestamp
   */
  setLastBalanceFetch(timestamp: number) {
    state.lastBalanceFetch = timestamp;
  },

  /**
   * Check if balances were fetched recently (within 30 seconds)
   * Used for deduplication to prevent rapid duplicate fetches
   */
  wereBalancesFetchedRecently(): boolean {
    if (!state.lastBalanceFetch) {
      return false;
    }
    const now = Date.now();
    const thirtySeconds = 30 * 1000;
    return now - state.lastBalanceFetch < thirtySeconds;
  }
};

export default SettingsStore;
