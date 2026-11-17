import Svg, {Line, Path} from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

/** Eye with a slash (Feather icon set, MIT): "hide". */
const SvgEyeOff = ({size = 22, color = 'white'}: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <Line x1={1} y1={1} x2={23} y2={23} />
  </Svg>
);
export default SvgEyeOff;
