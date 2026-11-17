import { useTheme } from '@/hooks/useTheme.ts';
import { StyleSheet, Text, View } from 'react-native';
import { PasswordInput } from '@/components/PasswordInput';
import React from 'react';

interface FieldWithLabelProps {
  label: string;
  value: string;
  onPress: () => void;
  onChangeText: (text: string) => void;
  isActive: boolean;
  placeholder: string;
}

export function FieldWithLabel({
                          label,
                          value,
                          onPress,
                          onChangeText,
                          isActive,
                          placeholder,
                        }: FieldWithLabelProps) {
  const Theme = useTheme();

  return (
    <View style={styles.inputContainer}>
      <Text style={[styles.inputLabel, { color: Theme['fg-100'] }]}>
        {label}
      </Text>
      <PasswordInput
        containerStyle={[
          styles.inputContainerFrame,
          {
            backgroundColor: Theme['bg-100'],
            borderColor: isActive ? Theme['accent-100'] : Theme['bg-250'],
          },
        ]}
        inputStyle={[styles.input, { color: Theme['fg-100'] }]}
        iconColor={Theme['fg-150']}
        secretName="PIN"
        value={value}
        onFocus={onPress}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Theme['fg-300']}
        maxLength={16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputContainerFrame: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
});