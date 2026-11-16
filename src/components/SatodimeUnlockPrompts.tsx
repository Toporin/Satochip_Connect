import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type {SatodimeInfo} from '@/types/WalletTypes';
import {registerSatodimePromptHost} from '@/wallets/satodime/satodimePrompts';

const MAX_CVC_LENGTH = 20;

/**
 * Host for the Satodime unlock prompts used when signing (mounted once):
 * - the code engraved on a CVC card;
 * - permission to claim an ownerless card.
 * Shown outside NFC sessions (see wallets/satodime/satodimeUnlock.ts).
 */
export function SatodimeUnlockPrompts() {
  const [cvcRequest, setCvcRequest] = useState<SatodimeInfo | null>(null);
  const [cvc, setCvc] = useState('');
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  useEffect(() => {
    registerSatodimePromptHost({
      requestCvc: (info: SatodimeInfo) =>
        new Promise<string | null>(resolve => {
          resolveRef.current?.(null); // a previous prompt left open is cancelled
          resolveRef.current = resolve;
          setCvc('');
          setCvcRequest(info);
        }),
      confirmClaim: (info: SatodimeInfo) =>
        new Promise<boolean>(resolve => {
          Alert.alert(
            'Claim this Satodime?',
            info.fixedUnlockSecret
              ? 'This card has no owner. To sign, this app must claim it. Anyone holding the card and its engraved code can also take ownership.'
              : 'This card has no owner. To sign, this app must claim it: it will then be the only app able to sign with this card. Ownership can be released later from the account screen.',
            [
              {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
              {text: 'Claim and sign', onPress: () => resolve(true)},
            ],
            {cancelable: true, onDismiss: () => resolve(false)},
          );
        }),
    });
    return () => registerSatodimePromptHost(null);
  }, []);

  const finish = (value: string | null) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setCvcRequest(null);
    setCvc('');
  };

  const trimmed = cvc.trim();

  return (
    <Modal visible={cvcRequest !== null} transparent animationType="fade" onRequestClose={() => finish(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Enter the card code</Text>
          <Text style={styles.text}>
            Enter the code engraved on your Satodime card
            {cvcRequest ? ` (vault #${cvcRequest.vaultIndex + 1})` : ''}. It is stored securely on this phone, so it
            is only asked once.
          </Text>
          <TextInput
            style={styles.input}
            value={cvc}
            onChangeText={setCvc}
            placeholder="Card code"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            maxLength={MAX_CVC_LENGTH}
          />
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={() => finish(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submit, !trimmed && styles.disabled]}
              disabled={!trimmed}
              onPress={() => finish(trimmed)}>
              <Text style={styles.submitText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  text: {
    fontSize: 13,
    color: '#444',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  cancelText: {
    color: '#666',
    fontWeight: '600',
  },
  submit: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  submitText: {
    color: 'white',
    fontWeight: '600',
  },
});
