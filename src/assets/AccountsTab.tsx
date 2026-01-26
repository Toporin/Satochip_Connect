import React from 'react';
import Svg, {Path} from 'react-native-svg';

interface Props {
  height?: number;
  width?: number;
  fill?: string;
}

export default function AccountsTab({
  height = 24,
  width = 24,
  fill = 'currentColor',
}: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 6.5V9.5L21 9ZM3 9V7L9 6.5V9.5L3 9ZM12 7C14.21 7 16.38 7.89 18 9.4V21H6V9.4C7.62 7.89 9.79 7 12 7Z"
        fill={fill}
      />
    </Svg>
  );
}