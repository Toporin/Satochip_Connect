import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = Math.min(SCREEN_WIDTH - 64, 320);

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  // NFT image
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
  },
  nftImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  // Header
  nftName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  tokenTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 20,
  },
  tokenTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Info sections
  section: {
    width: '100%',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoCard: {
    borderRadius: 12,
    padding: 14,
    gap: 10,
    width: '100%',
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  copyableValue: {
    textDecorationLine: 'underline',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 21,
  },
  // Link buttons
  linksContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  linkButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Not found
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  errorDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
