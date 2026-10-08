import { Text, StyleSheet, type TextProps } from 'react-native';

// Named static faces preserve the Figma weights without synthesizing bold on web or Android.
export function AppText({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const numeric = weight === 'bold' ? 700 : Number(weight ?? 400);
  const fontFamily =
    numeric >= 700
      ? 'NotoSansSCBold'
      : numeric >= 600
        ? 'NotoSansSCSemibold'
        : numeric >= 500
          ? 'NotoSansSCMedium'
          : 'NotoSansSC';
  return <Text {...props} style={[style, { fontFamily, fontWeight: 'normal' }]} />;
}
