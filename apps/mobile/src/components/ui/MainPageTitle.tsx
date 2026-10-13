import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { tokens } from '../../styles/tokens';

export function MainPageTitle({ title, size = 16 }: { title: string; size?: number }) {
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
    lineHeight: 24,
    textAlign: 'center',
  },
});
