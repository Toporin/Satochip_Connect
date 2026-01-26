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
    marginBottom: 32,
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
  instructionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionList: {
    gap: 8,
  },
  instructionItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  scanSection: {
    marginBottom: 24,
    gap: 16,
  },
  scanCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
    gap: 12,
  },
  scanTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scanningText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingIndicator: {
    marginBottom: 12,
  },
  connectingState: {
    alignItems: 'center',
    gap: 12,
  },
  connectingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scanButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpCard: {
    borderRadius: 16,
    padding: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});