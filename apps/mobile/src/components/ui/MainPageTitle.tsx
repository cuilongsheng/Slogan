import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { tokens } from '../../styles/tokens';

export function MainPageTitle({ title, size = 28 }: { title: string; size?: number }) {
  return (
    <View style={styles.row}>
      <Text accessibilityRole="header" style={[styles.title, { fontSize: size }]}>
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
    height: 42,
    lineHeight: 38,
    textAlign: 'center',
  },
});
