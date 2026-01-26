import { useTheme } from '@/hooks/useTheme.ts';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: Theme['bg-100'],
            color: Theme['fg-100'],
            borderColor: isActive ? Theme['accent-100'] : Theme['bg-250'],
          },
        ]}
        value={value}
        onFocus={onPress}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Theme['fg-300']}
        secureTextEntry
        maxLength={16}
        autoCapitalize="none"
        autoCorrect={false}
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
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});