import React, {useState} from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import SvgEye from '@/assets/Eye';
import SvgEyeOff from '@/assets/EyeOff';

interface Props extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  /** Style of the field frame (border, background...) */
  containerStyle?: StyleProp<ViewStyle>;
  /** Style of the text itself (colour, font...) */
  inputStyle?: StyleProp<TextStyle>;
  /** Colour of the show / hide icon */
  iconColor?: string;
}

/**
 * Password field, hidden by default, with a show / hide button at its right
 * end so the user can check what they typed. The icon shows the action: an
 * eye while hidden ("show"), a slashed eye while visible ("hide").
 * Only a tap on the icon switches the mode.
 */
export function PasswordInput({containerStyle, inputStyle, iconColor = '#888', ...inputProps}: Props) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
        style={[styles.input, inputStyle]}
        secureTextEntry={hidden}
      />
      <Pressable
        onPress={() => setHidden(h => !h)}
        hitSlop={12}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
        {hidden ? <SvgEye color={iconColor} /> : <SvgEyeOff color={iconColor} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
  },
  toggle: {
    marginLeft: 12,
  },
});
