import {useCallback, useEffect, useRef, useState} from 'react';
import { StyleSheet, TouchableOpacity, View, Text} from 'react-native';

import {
  Camera,
  Code,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,  // Add this
} from 'react-native-vision-camera';
import {useIsFocused} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';

import SvgChevronRight from '@/assets/ChevronRight';
import {RootStackScreenProps} from '@/utils/TypesUtil';
import {isURText, URScanner} from '@/airgap/urCodec';
import {ETH_SIGN_REQUEST_UR_TYPE} from '@/airgap/signRequest';
import styles from './styles';

type Props = RootStackScreenProps<'Scan'>;

export default function Scan({navigation}: Props) {
  const device = useCameraDevice('back', {physicalDevices: ['wide-angle-camera']});
  const {hasPermission, requestPermission} = useCameraPermission();  // Add this

  // 2. Only activate Camera when the app is focused and this screen is currently opened
  const isActive = useIsFocused();

  // ERC-4527 (UR) multipart scanning state. Kept in refs: the code scanner
  // callback fires for every camera frame, so we avoid re-rendering per frame.
  const urScannerRef = useRef(new URScanner());
  const handledRef = useRef(false);
  const lastPercentRef = useRef(-1);
  const [urPercent, setUrPercent] = useState<number | null>(null);
  const [urError, setUrError] = useState<string | null>(null);

  const resetUr = useCallback(() => {
    urScannerRef.current.reset();
    handledRef.current = false;
    lastPercentRef.current = -1;
    setUrPercent(null);
    setUrError(null);
  }, []);

  const handleUrPart = (value: string) => {
    const res = urScannerRef.current.receivePart(value);
    if (res.duplicate) {
      return;
    }
    if (res.error) {
      setUrError(prev => (prev === res.error ? prev : res.error!));
      return;
    }
    if (res.done) {
      handledRef.current = true;
      const ur = urScannerRef.current.getResult()!;
      if (ur.type !== ETH_SIGN_REQUEST_UR_TYPE) {
        console.warn(`[Airgap] unsupported UR type scanned: ${ur.type}`);
        setUrPercent(null);
        setUrError(
          `Unsupported QR code type "${ur.type}". Scan an Ethereum sign request from your browser extension.`,
        );
        return;
      }
      console.info(`[Airgap] eth-sign-request scanned (${ur.cbor.length} bytes)`);
      navigation.replace('AirgapReview', {
        cborHex: ur.cbor.toString('hex'),
        urType: ur.type,
      });
      return;
    }
    const percent = Math.floor(res.progress * 100);
    if (percent !== lastPercentRef.current) {
      lastPercentRef.current = percent;
      setUrPercent(percent);
      setUrError(null);
    }
  };

  const onCodeScanned = (codes: Code[]) => {
    if (handledRef.current) {
      return;
    }
    const value = codes[0]?.value;
    if (!value) {
      return;
    }
    if (isURText(value)) {
      handleUrPart(value);
      return;
    }
    // Anything else: WalletConnect flow (unchanged)
    handledRef.current = true;
    const uri = value;
    navigation.navigate('Home', {
      screen: 'ConnectionsStack',
      params: {screen: 'Connections', params: {uri: uri!}},
    });
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned,
  });

  const goBack = () => {
    navigation.goBack();
  };

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  return (
    <SafeAreaView style={StyleSheet.absoluteFill}>
      <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={40}>
        <SvgChevronRight
          fill="white"
          height={24}
          width={24}
          style={styles.backIcon}
        />
      </TouchableOpacity>

      {hasPermission && device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          codeScanner={codeScanner}
        />
      ) : (
        <View style={styles.errorContainer}>
          <Text>Camera not available</Text>
        </View>
      )}

      {(urPercent !== null || urError) && (
        <View style={styles.urOverlay}>
          {urPercent !== null && (
            <>
              <Text style={styles.urText}>Scanning animated QR code… {urPercent}%</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, {width: `${urPercent}%`}]} />
              </View>
            </>
          )}
          {urError && (
            <>
              <Text style={styles.urError}>{urError}</Text>
              <TouchableOpacity onPress={resetUr} style={styles.urRetry}>
                <Text style={styles.urRetryText}>Scan again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
