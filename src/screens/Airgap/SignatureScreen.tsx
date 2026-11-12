import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';

import {RootStackScreenProps} from '@/utils/TypesUtil';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ActionButton} from '@/components/ActionButton';
import {makeUR} from '@/airgap/urCodec';
import {AnimatedUrQR} from './AnimatedUrQR';

type Props = RootStackScreenProps<'AirgapSignature'>;

export default function SignatureScreen({route, navigation}: Props) {
  const Theme = useTheme();
  const insets = useSafeAreaInsets();
  const {cborHex, summary} = route.params;
  const ur = useMemo(() => makeUR(Buffer.from(cborHex, 'hex'), 'eth-signature'), [cborHex]);

  return (
    <ScrollView
      style={{backgroundColor: Theme['bg-100']}}
      contentContainerStyle={[styles.content, {paddingBottom: 16 + insets.bottom}]}>
      <Text style={[styles.title, {color: Theme['fg-100']}]}>Signed</Text>
      {summary ? (
        <Text style={[styles.text, {color: Theme['fg-175']}]}>{summary}</Text>
      ) : null}
      <AnimatedUrQR ur={ur} />
      <Text style={[styles.text, {color: Theme['fg-150']}]}>
        In your browser extension, click "Get signature" (or "Scan") and show this QR code to your
        computer's camera.
      </Text>
      <ActionButton style={styles.button} onPress={() => navigation.popToTop()}>
        Done
      </ActionButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    rowGap: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 48,
  },
});
