import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppText as Text } from './AppText';
import { tokens } from '../../styles/tokens';

export function MainPageTitle({
  title,
  size = 16,
  style,
  textStyle,
}: {
  title: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      <Text accessibilityRole="header" style={[styles.title, { fontSize: size }, textStyle]}>
        {title}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { height: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  title: {
    color: tokens.color.headingInk,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
});
