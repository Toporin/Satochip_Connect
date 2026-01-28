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
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountsList: {
    gap: 12,
  },
  accountCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  accountTypeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  accountTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountDetails: {
    gap: 4,
  },
  accountLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  accountValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  copyableText: {
    textDecorationLine: 'underline',
  },
  emptyState: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  chevronButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    padding: 8,
  },
  sendIconButton: {
    position: 'absolute',
    top: 60,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12, //8
  },
  sendIconText: {
    fontSize: 12,
    fontWeight: '600',
  },
  buySatochipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  buySatochipText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});