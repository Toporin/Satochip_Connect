import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackScreenProps} from '@/utils/TypesUtil';
import {useTheme} from '@/hooks/useTheme';
import {ActionButton} from '@/components/ActionButton';
import {EmphasizedAddress} from './SingleKeySyncScreen';

type Props = RootStackScreenProps<'AirgapHelperError'>;

/**
 * Shown right after scanning a sign request for a helper key (#2..#5) of a
 * single-key account, before any review, PIN, password or NFC prompt.
 * Nothing is signed.
 */
export default function HelperErrorScreen({route, navigation}: Props) {
  const Theme = useTheme();
  const insets = useSafeAreaInsets();
  const {accountId, helperIndex, helperAddress, primaryAddress} = route.params;

  return (
    <ScrollView
      style={{backgroundColor: Theme['bg-100']}}
      contentContainerStyle={[styles.content, {paddingBottom: 24 + insets.bottom}]}>
      <Text style={[styles.title, {color: Theme['error-100']}]}>Wrong address selected in your browser wallet</Text>

      <Text style={[styles.text, {color: Theme['fg-100']}]}>
        This request is for helper address #{helperIndex}, which this app will never sign for:
      </Text>
      <View style={[styles.card, {backgroundColor: Theme['bg-150']}]}>
        <Text style={[styles.small, {color: Theme['error-100']}]}>Helper address #{helperIndex} - do not use</Text>
        <EmphasizedAddress address={helperAddress} color={Theme['fg-175']} strongColor={Theme['fg-100']} />
      </View>

      <Text style={[styles.text, {color: Theme['fg-100']}]}>
        In MetaMask/Rabby, remove that account and use address #1 instead:
      </Text>
      <View style={[styles.card, styles.primary, {backgroundColor: Theme['bg-150'], borderColor: Theme['accent-100']}]}>
        <Text style={[styles.small, {color: Theme['fg-150']}]}>Address #1 - your account</Text>
        <EmphasizedAddress address={primaryAddress} color={Theme['fg-150']} strongColor={Theme['accent-100']} />
      </View>

      <Text style={[styles.text, styles.strong, {color: Theme['fg-100']}]}>No transaction was signed.</Text>

      <ActionButton
        style={styles.button}
        onPress={() => navigation.replace('AirgapSingleKeySync', {accountId})}>
        Show pairing QR again
      </ActionButton>
      <ActionButton secondary style={styles.button} onPress={() => navigation.goBack()}>
        Close
      </ActionButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    rowGap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  strong: {
    fontWeight: '700',
  },
  small: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    padding: 12,
    rowGap: 4,
  },
  primary: {
    borderWidth: 2,
  },
  button: {
    width: '100%',
    height: 48,
  },
});
