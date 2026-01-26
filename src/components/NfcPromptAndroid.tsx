import { Animated, Modal, Platform, StyleSheet, Pressable, View } from 'react-native';
import NFCSVG from '@/assets/images/nfc.svg';
import React from 'react';
import Text from '@/components/KeeperText';
import { windowWidth } from '@/constants/responsive';
import NfcManager from 'react-native-nfc-manager';
import { useTheme } from '@/context/ThemeContext';

function NfcPrompt({
                     visible = true,
                     close,
                     ctaText,
                   }: {
  visible: boolean;
  close: () => void;
  ctaText?: string;
}) {

  const { isDarkMode, colors } = useTheme();

  const animation = React.useRef(new Animated.Value(0)).current;

  if (Platform.OS === 'ios') {
    return null;
  }

  if (visible) {
    Animated.timing(animation, {
      duration: 500,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  } else {
    Animated.timing(animation, {
      duration: 400,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }

  const onCancel = async () => {
    Animated.timing(animation, {
      duration: 400,
      toValue: 0,
      useNativeDriver: true,
    }).start(async () => {
      close();
      const isEnabled = await NfcManager.isEnabled();
      if (isEnabled) NfcManager.cancelTechnologyRequest();
    });
  };

  const bgAnimStyle = {
    backgroundColor: 'rgba(0,0,0,0.3)',
    opacity: animation,
  };

  const promptAnimStyle = {
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [300, 0],
        }),
      },
    ],
  };

  // Define your colors based on theme
  const backgroundColor = isDarkMode ? '#2a2a2a' : '#f5f5f5'; // Adjust colors
  const textColor = isDarkMode ? '#4ade80' : '#16a34a'; // Adjust colors

  return (
    <Modal transparent visible={visible}>
      <View style={[styles.wrapper]}>
        <View style={{ flex: 1 }} />
        <Animated.View style={[styles.prompt, promptAnimStyle]}>
          <View style={[styles.center, { backgroundColor }]}>
            <NFCSVG />
            <Text style={{ textAlign: 'center', color: textColor }}>
              {"Please hold until the scanning is complete..."}
            </Text>
            <Pressable style={styles.cancel} onPress={onCancel}>
              <Text style={{ textAlign: 'center', color: textColor }}>
                {ctaText || 'Cancel'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
        <Animated.View style={[styles.promptBg, bgAnimStyle]} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  promptBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  prompt: {
    height: 300,
    zIndex: 2,
    alignSelf: 'stretch',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 20,
    margin: 20,
  },
  cancel: {
    width: windowWidth * 0.7,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,.2)',
    borderRadius: 10,
    marginTop: 5,
  },
});

export default NfcPrompt;