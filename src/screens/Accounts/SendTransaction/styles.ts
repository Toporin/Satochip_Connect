import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  accountName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  accountAddress: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  formHelp: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  errorInput: {
    borderWidth: 2,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  amountInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  amountInput: {
    flex: 1,
  },
  maxButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maxButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  usdValue: {
    fontSize: 13,
    marginTop: 4,
  },
  gasContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  gasLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  gasValueContainer: {
    alignItems: 'flex-end',
  },
  gasValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  gasUsd: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingIndicator: {
    marginRight: 8,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValueContainer: {
    alignItems: 'flex-end',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValueUsd: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryAddress: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  summaryTotalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  sendButton: {
    backgroundColor: '#007AFF', // Will be overridden by theme
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});
