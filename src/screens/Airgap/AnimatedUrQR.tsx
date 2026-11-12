import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type {UR} from '@ngraveio/bc-ur';

import {createURFrameEncoder, DEFAULT_MAX_FRAGMENT_LENGTH} from '@/airgap/urCodec';
import {useTheme} from '@/hooks/useTheme';

interface Props {
  ur: UR;
  size?: number;
  /** ms between frames */
  interval?: number;
  maxFragmentLength?: number;
}

/**
 * Displays a UR as a (possibly animated, fountain-coded) QR code.
 * Frames are UPPERCASE so the QR uses alphanumeric mode.
 */
export function AnimatedUrQR({
  ur,
  size = 280,
  interval = 220,
  maxFragmentLength = DEFAULT_MAX_FRAGMENT_LENGTH,
}: Props) {
  const Theme = useTheme();
  const encoder = useMemo(
    () => createURFrameEncoder(ur, maxFragmentLength),
    [ur, maxFragmentLength],
  );
  const [frame, setFrame] = useState<string>(() => encoder.nextFrame());

  useEffect(() => {
    setFrame(encoder.nextFrame());
    if (encoder.isSinglePart) {
      return;
    }
    const timer = setInterval(() => setFrame(encoder.nextFrame()), interval);
    return () => clearInterval(timer);
  }, [encoder, interval]);

  return (
    <View style={styles.container}>
      <View style={styles.qrBackground}>
        <QRCode value={frame} size={size} ecl="L" backgroundColor="white" color="black" />
      </View>
      {!encoder.isSinglePart && (
        <Text style={[styles.caption, {color: Theme['fg-175']}]}>
          Animated QR code ({encoder.fragmentCount} parts) – keep it in front of the camera
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  qrBackground: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  caption: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
});
