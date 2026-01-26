import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardInfo: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  cardInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardInfoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    gap: 20,
    marginBottom: 32,
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
  accountIndexContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountIndexButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIndexButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  accountIndexDisplay: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIndexText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewAddress: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  createButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});