import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ethers } from 'ethers';
import { SatochipCard } from 'satochip-react-native';

import { useTheme } from '@/hooks/useTheme';
import useSatochipModal from '@/hooks/useSatochipModal';
import { AccountsStackParamList } from '@/utils/TypesUtil';
import SettingsStore from '@/store/SettingsStore';
import BalanceService from '@/services/BalanceService';
import TransactionService from '@/services/TransactionService';
import PriceService from '@/services/PriceService';
import { ChainSelector } from '@/components/ChainSelector';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { PinModal } from '@/components/Modal/PinModal';
import { validateAddress, validateAmount, calculateMaxAmount, formatGasCost } from '@/utils/TransactionUtils';
import { formatBalance, formatUSD, truncateAddress, calculateUSDValue } from '@/utils/formatters';
import { approveEIP155RequestEnhanced } from '@/utils/EnhancedEIP155RequestHandler';
import { EIP155_SIGNING_METHODS, EIP155_CHAINS } from '@/constants/Eip155';
import { PresetsUtil } from '@/utils/PresetsUtil';
import { WalletType } from '@/types/WalletTypes';
import NfcPromptAndroid from '@/components/NfcPromptAndroid';

import styles from './styles';

type SendTransactionRouteProp = RouteProp<AccountsStackParamList, 'SendTransaction'>;
type SendTransactionNavigationProp = StackNavigationProp<AccountsStackParamList, 'SendTransaction'>;

const SendTransactionScreen: React.FC = () => {
  const Theme = useTheme();
  const navigation = useNavigation<SendTransactionNavigationProp>();
  const route = useRoute<SendTransactionRouteProp>();
  const { accountId, chainId: initialChainId } = route.params;

  // Get wallet
  const wallet = SettingsStore.getWallet(accountId);
  const [card] = useState(new SatochipCard());
  const { nfcVisible, withModal, closeNfc } = useSatochipModal(card);

  // Form state
  const [selectedChainId, setSelectedChainId] = useState<number>(initialChainId || 1);
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  // Transaction params
  const [nonce, setNonce] = useState<number | null>(null);
  const [gasLimit, setGasLimit] = useState<string>('0x5208'); // 21000 default
  const [gasPrice, setGasPrice] = useState<string | null>(null);
  const [maxFeePerGas, setMaxFeePerGas] = useState<string | null>(null);
  const [maxPriorityFeePerGas, setMaxPriorityFeePerGas] = useState<string | null>(null);

  // Balance and prices
  const [balance, setBalance] = useState<string>('0');
  const [balanceLoading, setBalanceLoading] = useState<boolean>(true);
  const [priceUSD, setPriceUSD] = useState<number | null>(null);

  // UI state
  const [isLoadingGas, setIsLoadingGas] = useState<boolean>(false);
  const [isLoadingNonce, setIsLoadingNonce] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);

  // Validation
  const [addressError, setAddressError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [ctaDisabled, setCtaDisabled] = useState(true); // disable/enable send button

  // Result
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if wallet exists
  if (!wallet) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: Theme['bg-100'] }]}>
        <Text style={[styles.errorTitle, { color: Theme['error-100'] }]}>
          Wallet Not Found
        </Text>
        <Text style={[styles.errorMessage, { color: Theme['fg-150'] }]}>
          The requested wallet could not be found.
        </Text>
      </View>
    );
  }

  // Get chain info
  const chainKey = `eip155:${selectedChainId}`;
  const chainInfo = EIP155_CHAINS[chainKey];
  const chainName = chainInfo?.name || `Chain ${selectedChainId}`;
  const chainSymbol = chainInfo?.symbol || ``;
  const chainLogo = PresetsUtil.getChainLogo(chainKey);

  // Fetch balance on mount and chain change
  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet) return;
      setBalanceLoading(true);
      try {
        const balanceEntry = await BalanceService.fetchBalance(wallet.address, selectedChainId);
        setBalance(balanceEntry.balance);

        // Fetch price
        const price = await PriceService.getPriceForChain(selectedChainId);
        setPriceUSD(price);
      } catch (error) {
        console.error('[SendTransaction] Error fetching balance:', error);
        setBalance('0');
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [wallet, selectedChainId]);

  // Fetch gas price on chain change
  useEffect(() => {
    const fetchGasPrice = async () => {
      try {
        const gasPriceResult = await TransactionService.fetchGasPrice(selectedChainId);
        if (gasPriceResult.maxFeePerGas && gasPriceResult.maxPriorityFeePerGas) {
          setGasPrice(null);
          setMaxFeePerGas(gasPriceResult.maxFeePerGas);
          setMaxPriorityFeePerGas(gasPriceResult.maxPriorityFeePerGas);
        } else if (gasPriceResult.legacy) {
          setGasPrice(gasPriceResult.legacy);
          setMaxFeePerGas(null);
          setMaxPriorityFeePerGas(null);
        }
      } catch (error) {
        console.error('[SendTransaction] Error fetching gas price:', error);
      }
    };

    fetchGasPrice();
  }, [selectedChainId]);

  // Fetch nonce when needed
  const fetchNonce = useCallback(async () => {
    if (!wallet) return;
    setIsLoadingNonce(true);
    try {
      const fetchedNonce = await TransactionService.fetchNonce(wallet.address, selectedChainId);
      setNonce(fetchedNonce);
    } catch (error) {
      console.error('[SendTransaction] Error fetching nonce:', error);
      setNonce(0); // Fallback
    } finally {
      setIsLoadingNonce(false);
    }
  }, [wallet, selectedChainId]);

  // Estimate gas when amount changes (debounced)
  useEffect(() => {
    if (!recipientAddress || !amount || !wallet) return;

    // Validate first
    const addrError = validateAddress(recipientAddress, wallet.address);
    const balanceEth = formatBalance(balance, 18, 18);
    const gasCostEth = formatGasCost(gasLimit, gasPrice || maxFeePerGas || '0');
    const amtError = validateAmount(amount, balanceEth, gasCostEth);

    if (addrError || amtError) {
      return; // Don't estimate if invalid
    }

    const timeoutId = setTimeout(async () => {
      setIsLoadingGas(true);
      try {
        const amountWei = ethers.utils.parseEther(amount).toHexString();
        const estimatedGas = await TransactionService.estimateGas(
          wallet.address,
          recipientAddress,
          amountWei,
          '0x',
          selectedChainId
        );
        setGasLimit(estimatedGas);
      } catch (error) {
        console.error('[SendTransaction] Error estimating gas:', error);
        setGasLimit('0x5208'); // Fallback to 21000
      } finally {
        setIsLoadingGas(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [recipientAddress, amount, wallet, selectedChainId, balance, gasLimit, gasPrice, maxFeePerGas]);

  // Handle chain selection
  const handleChainChange = (chainId: number) => {
    setSelectedChainId(chainId);
    setAmount(''); // Reset amount when chain changes
    setRecipientAddress(''); // Reset recipient
    setAddressError(null);
    setAmountError(null);
  };

  // Handle recipient change
  const handleRecipientChange = (text: string) => {
    setRecipientAddress(text);
    if (text.trim() === '') {
      setAddressError(null);
    } else {
      const error = validateAddress(text, wallet?.address);
      setAddressError(error);
    }
  };

  // Handle amount change
  const handleAmountChange = (text: string) => {
    // Only allow numbers and one decimal point
    if (text && !/^\d*\.?\d*$/.test(text)) {
      return;
    }

    setAmount(text);

    if (text.trim() === '') {
      setAmountError(null);
      return;
    }

    // Validate amount
    const balanceEth = formatBalance(balance, 18, 18);
    const gasCostEth = formatGasCost(gasLimit, gasPrice || maxFeePerGas || '0');
    const error = validateAmount(text, balanceEth, gasCostEth);
    setAmountError(error);
  };

  // Handle max button
  const handleMaxAmount = () => {
    const effectiveGasPrice = gasPrice || maxFeePerGas || '0';
    const maxAmount = calculateMaxAmount(balance, gasLimit, effectiveGasPrice);
    setAmount(maxAmount);
    setAmountError(null);
  };

  // Calculate USD values
  const amountUsd = priceUSD && amount ? formatUSD(parseFloat(amount) * priceUSD) : null;
  const gasCostEth = formatGasCost(gasLimit, gasPrice || maxFeePerGas || '0');
  const gasCostUsd = priceUSD ? formatUSD(parseFloat(gasCostEth) * priceUSD) : null;
  const totalEth = amount ? (parseFloat(amount) + parseFloat(gasCostEth)).toFixed(6) : '0';
  const totalUsd = priceUSD && amount ? formatUSD(parseFloat(totalEth) * priceUSD) : null;

  // Check if form is valid
  const isFormValid =
    !balanceLoading &&
    recipientAddress.trim() !== '' &&
    !addressError &&
    amount.trim() !== '' &&
    !amountError &&
    (gasPrice !== null || (maxFeePerGas !== null && maxPriorityFeePerGas !== null));

  // Handle send button
  const handleSend = async () => {
    if (!isFormValid) return;

    // Fetch nonce if not already fetched
    if (nonce === null) {
      await fetchNonce();
    }

    setShowConfirmModal(true);
  };

  // Handle confirmation
  const handleConfirm = () => {
    setShowConfirmModal(false);
    setShowPinModal(true);
  };

  // Handle PIN submission
  const handlePinSubmit = async (pin: string) => {
    if (!wallet || nonce === null) return;

    setIsSending(true);
    setShowPinModal(false);

    try {
      // Build transaction
      const transaction = TransactionService.buildTransaction({
        from: wallet.address,
        to: recipientAddress,
        value: ethers.utils.parseEther(amount).toHexString(),
        chainId: selectedChainId,
        nonce: nonce,
        gasLimit: gasLimit,
        gasPrice: gasPrice || undefined,
        maxFeePerGas: maxFeePerGas || undefined,
        maxPriorityFeePerGas: maxPriorityFeePerGas || undefined,
        data: '0x',
      });

      // Create mock RequestEventArgs
      const mockRequestEvent: any = {
        topic: 'internal-send-transaction',
        params: {
          chainId: `eip155:${selectedChainId}`,
          request: {
            method: EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION,
            params: [transaction],
          },
        },
        id: Date.now(),
      };

      // Call existing signing logic
      const response = await approveEIP155RequestEnhanced(
        mockRequestEvent,
        pin,
        card,
        withModal,
        closeNfc
      );

      // Extract transaction hash
      if ('result' in response) {
        const hash = response.result;
        setTxHash(hash);
        setErrorMessage(null);

        // Show success and navigate back
        setTimeout(() => {
          navigation.goBack();
        }, 3000);
      } else {
        throw new Error(response.error?.message || 'Transaction failed');
      }
    } catch (error: any) {
      console.error('[SendTransaction] Error sending transaction:', error);
      setErrorMessage(error.message || 'Failed to send transaction');
      setTxHash(null);
    } finally {
      setIsSending(false);
    }
  };

  // Render loading state
  if (balanceLoading && balance === '0') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Theme['bg-100'] }]}>
        <ActivityIndicator size="large" color={Theme['accent-100']} />
        <Text style={[styles.loadingText, { color: Theme['fg-150'] }]}>
          Loading balance...
        </Text>
      </View>
    );
  }

  // Render success state
  if (txHash) {
    return (
      <View style={[styles.container, { backgroundColor: Theme['bg-100'] }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.accountName, { color: Theme['accent-100'] }]}>
            Transaction Sent!
          </Text>
          <Text style={[styles.accountAddress, { color: Theme['fg-150'] }]}>
            {truncateAddress(txHash, 10, 10)}
          </Text>
          <Text style={[styles.balanceText, { color: Theme['fg-100'], marginTop: 16 }]}>
            Redirecting...
          </Text>
        </View>
      </View>
    );
  }

  // Render error state
  if (errorMessage && !isSending) {
    return (
      <View style={[styles.container, { backgroundColor: Theme['bg-100'] }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: Theme['error-100'] }]}>
            Transaction Failed
          </Text>
          <Text style={[styles.errorMessage, { color: Theme['fg-150'] }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: Theme['accent-100'], marginTop: 24 }]}
            onPress={() => {
              setErrorMessage(null);
              setTxHash(null);
            }}
          >
            <Text style={[styles.buttonText, { color: Theme['inverse-100'] }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Theme['bg-100'] }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.accountName, { color: Theme['fg-100'] }]}>
            {wallet.getWalletInfo().name || 'Account'}
          </Text>
          <Text style={[styles.accountAddress, { color: Theme['fg-150'] }]}>
            {truncateAddress(wallet.address)}
          </Text>
          <Text style={[styles.balanceText, { color: Theme['fg-100'] }]}>
            Balance: {formatBalance(balance, 18, 6)} {chainSymbol}
            {priceUSD && ` (${formatUSD(calculateUSDValue(balance, 18, priceUSD))})`}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Chain Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: Theme['fg-100'] }]}>
              Network
            </Text>
            <ChainSelector
              selectedChainId={selectedChainId}
              onSelect={handleChainChange}
            />
          </View>

          {/* Recipient Address */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: Theme['fg-100'] }]}>
              Recipient Address
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: Theme['bg-150'],
                  borderColor: addressError ? Theme['error-100'] : Theme['bg-300'],
                  color: Theme['fg-100'],
                },
                addressError && styles.errorInput,
              ]}
              value={recipientAddress}
              onChangeText={handleRecipientChange}
              placeholder="0x..."
              placeholderTextColor={Theme['fg-300']}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            {addressError && (
              <Text style={[styles.errorText, { color: Theme['error-100'] }]}>
                {addressError}
              </Text>
            )}
          </View>

          {/* Amount */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: Theme['fg-100'] }]}>
              Amount
            </Text>
            <View style={styles.amountInputContainer}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.amountInput,
                  {
                    backgroundColor: Theme['bg-150'],
                    borderColor: amountError ? Theme['error-100'] : Theme['bg-300'],
                    color: Theme['fg-100'],
                  },
                  amountError && styles.errorInput,
                ]}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.0"
                placeholderTextColor={Theme['fg-300']}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={[
                  styles.maxButton,
                  { backgroundColor: Theme['accent-glass-020'], borderColor: Theme['accent-100'], borderWidth: 1 },
                ]}
                onPress={handleMaxAmount}
              >
                <Text style={[styles.maxButtonText, { color: Theme['accent-100'] }]}>
                  Max
                </Text>
              </TouchableOpacity>
            </View>
            {amountUsd && !amountError && (
              <Text style={[styles.usdValue, { color: Theme['fg-150'] }]}>
                ≈ {amountUsd}
              </Text>
            )}
            {amountError && (
              <Text style={[styles.errorText, { color: Theme['error-100'] }]}>
                {amountError}
              </Text>
            )}
          </View>

          {/* Gas Fee Display */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: Theme['fg-100'] }]}>
              Network Fee
            </Text>
            <View style={[styles.gasContainer, { backgroundColor: Theme['bg-150'] }]}>
              <Text style={[styles.gasLabel, { color: Theme['fg-150'] }]}>
                Estimated gas
              </Text>
              <View style={styles.gasValueContainer}>
                {isLoadingGas ? (
                  <ActivityIndicator size="small" color={Theme['accent-100']} style={styles.loadingIndicator} />
                ) : (
                  <>
                    <Text style={[styles.gasValue, { color: Theme['fg-100'] }]}>
                      {gasCostEth} {chainSymbol}
                    </Text>
                    {gasCostUsd && (
                      <Text style={[styles.gasUsd, { color: Theme['fg-150'] }]}>
                        ≈ {gasCostUsd}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Summary Card */}
        {isFormValid && (
          <View style={[styles.summaryCard, { backgroundColor: Theme['bg-150'], borderColor: Theme['bg-200'], borderWidth: 1 }]}>
            <Text style={[styles.summaryTitle, { color: Theme['fg-100'] }]}>
              Summary
            </Text>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: Theme['fg-150'] }]}>
                You're sending
              </Text>
              <View style={styles.summaryValueContainer}>
                <Text style={[styles.summaryValue, { color: Theme['fg-100'] }]}>
                  {amount} {chainSymbol}
                </Text>
                {amountUsd && (
                  <Text style={[styles.summaryValueUsd, { color: Theme['fg-150'] }]}>
                    ≈ {amountUsd}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: Theme['fg-150'] }]}>
                To
              </Text>
              <Text style={[styles.summaryAddress, { color: Theme['fg-100'] }]}>
                {truncateAddress(recipientAddress, 6, 6)}
              </Text>
            </View>

            <View style={[styles.summaryRow, styles.summaryTotalRow, { borderTopColor: Theme['bg-200'] }]}>
              <Text style={[styles.summaryTotalLabel, { color: Theme['fg-100'] }]}>
                Total cost
              </Text>
              <View style={styles.summaryValueContainer}>
                <Text style={[styles.summaryTotalValue, { color: Theme['fg-100'] }]}>
                  {totalEth} {chainSymbol}
                </Text>
                {totalUsd && (
                  <Text style={[styles.summaryValueUsd, { color: Theme['fg-150'] }]}>
                    ≈ {totalUsd}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: Theme['bg-200'] },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.buttonText, { color: Theme['fg-100'] }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.sendButton,
              // { backgroundColor: Theme['accent-100'] },
              {backgroundColor: (!isFormValid || isSending)
              ? Theme['bg-250']
              : Theme['accent-100']},
              // (!isFormValid || isSending) && styles.buttonDisabled,
            ]}
            onPress={handleSend}
            disabled={!isFormValid || isSending}
          >
            {isSending ? (
              <ActivityIndicator color={Theme['inverse-100']} />
            ) : (
              <Text style={[styles.sendButtonText, { color: Theme['inverse-100'] }]}>
                Send
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modals */}
      <ConfirmationModal
        visible={showConfirmModal}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirmModal(false)}
        chainName={chainName}
        chainIcon={chainLogo}
        recipient={recipientAddress}
        amount={amount}
        symbol={chainSymbol}
        gasCost={gasCostEth}
        total={totalEth}
        amountUsd={amountUsd || undefined}
        gasCostUsd={gasCostUsd || undefined}
        totalUsd={totalUsd || undefined}
      />

      <PinModal
        visible={showPinModal}
        onSubmit={handlePinSubmit}
        onCancel={() => setShowPinModal(false)}
        title={wallet.type === WalletType.SATOCHIP ? 'Enter PIN' : 'Enter Password'}
        minLength={wallet.type === WalletType.SATOCHIP ? 4 : 8}
        maxLength={wallet.type === WalletType.SATOCHIP ? 16 : 64}
        type={wallet.type === WalletType.SATOCHIP ? 'PIN' : 'password'}
      />

      {Platform.OS === 'android' && wallet.type === WalletType.SATOCHIP && (
        <NfcPromptAndroid visible={nfcVisible} close={closeNfc} />
      )}
    </View>
  );
};

export default SendTransactionScreen;
