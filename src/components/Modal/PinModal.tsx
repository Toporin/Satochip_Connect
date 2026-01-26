// components/PinModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface PinModalProps {
  visible: boolean;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  title?: string;
  minLength?: number;
  maxLength?: number;
  type: 'PIN' | 'password';
}

export const PinModal: React.FC<PinModalProps> = ({
    visible,
    onSubmit,
    onCancel,
    title = 'Enter PIN Code',
    minLength = 4,
    maxLength = 16,
    type = 'PIN',
  }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (pin.length < minLength) {
      setError(`${type} must be at least ${minLength} digits`);
      return;
    }
    if (pin.length > maxLength) {
      setError(`${type} must be at most ${maxLength} digits`);
      return;
    }
    onSubmit(pin);
    setPin('');
    setError('');
  };

  const handleCancel = () => {
    setPin('');
    setError('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>{title}</Text>

          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(text) => {
              setPin(text);
              setError('');
              // if (type==='PIN'){
              //   // Only allow digits // todo: remove restriction?
              //   const digitsOnly = text.replace(/[^0-9]/g, '');
              //   setPin(digitsOnly);
              //   setError('');
              // } else {
              //   setPin(text);
              //   setError('');
              // }
            }}
            placeholder={`Enter ${type} (${minLength}-${maxLength} digits)`}
            // keyboardType={type==='PIN'? "numeric": "default"}
            secureTextEntry={true}
            maxLength={maxLength}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            autoFocus={true}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={pin.length < minLength}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 4,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  buttonContainer: {
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
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});