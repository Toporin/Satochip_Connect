import {StyleSheet} from 'react-native';

export default StyleSheet.create({
  backButton: {
    zIndex: 1,
    backgroundColor: 'black',
    opacity: 0.7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    height: 36,
    width: 36,
    marginTop: 16,
    marginLeft: 16,
  },
  backIcon: {
    transform: [{rotate: '180deg'}],
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 48,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    rowGap: 10,
  },
  urText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  urError: {
    color: '#fca5a5',
    fontSize: 13,
    textAlign: 'center',
  },
  urRetry: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  urRetryText: {
    color: 'white',
    fontWeight: '600',
  },
});
