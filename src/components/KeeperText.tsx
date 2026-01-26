import React from 'react';
import { Text as RNText, TextProps } from 'react-native';

interface KeeperTextProps extends TextProps {
  color?: string;
  fontSize?: number;
  bold?: boolean;
  light?: boolean;
  italic?: boolean;
  medium?: boolean;
  semiBold?: boolean;
  fontWeight?: string | number;
}

function Text(props: KeeperTextProps) {
  const {
    children,
    style,
    fontSize,
    medium,
    semiBold,
    bold = false,
    light = false,
    italic,
    fontWeight = undefined,
    color,
    ...restProps
  } = props;

  let computedFontWeight: string | number = fontWeight || '400';

  if (!fontWeight) {
    if (bold) {
      computedFontWeight = '700';
    } else if (light) {
      computedFontWeight = '300';
    } else if (medium) {
      computedFontWeight = '500';
    } else if (semiBold) {
      computedFontWeight = '600';
    } else {
      computedFontWeight = '400';
    }
  }

  const passedStyles = Array.isArray(style) ? Object.assign({}, ...style) : style;
  const lineHeight = passedStyles?.lineHeight
    ? passedStyles?.lineHeight
    : fontSize
      ? fontSize * 1.5
      : passedStyles?.fontSize
        ? passedStyles?.fontSize * 1.5
        : undefined;

  return (
    <RNText
      allowFontScaling={false}
      {...restProps}
      style={[
        {
          fontSize,
          fontWeight: computedFontWeight,
          lineHeight,
          fontStyle: italic ? 'italic' : 'normal',
          color: color || passedStyles?.color,
        },
        passedStyles,
      ]}
    >
      {children}
    </RNText>
  );
}

export default Text;