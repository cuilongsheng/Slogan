import { StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/ui/AppText';
import { tokens } from '../../styles/tokens';
import { t, useLanguage } from '../../services/locale';
import { useLiveUpdates } from './context';
export function LiveConnectionNotice({ manualRefresh = true }: { manualRefresh?: boolean }) {
  useLanguage();
  const { status, owner } = useLiveUpdates();
  return owner && status === 'reconnecting' ? (
    <Text accessibilityRole="alert" style={styles.text}>
      {t(manualRefresh ? 'liveReconnecting' : 'directCallReconnecting')}
    </Text>
  ) : null;
}
const styles = StyleSheet.create({
  text: {
    color: tokens.color.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
