import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';

export function MainListEmpty({
  onRefresh,
  error,
  disabled = false,
}: {
  onRefresh: () => void;
  error?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <View style={styles.body}>
      <View style={styles.panel}>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled}
          onPress={onRefresh}
          testID="empty-list-refresh"
          style={[styles.button, disabled && styles.disabled]}
        >
          <Text style={styles.label}>{t('refreshAction')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  body: { flex: 1 },
  panel: { position: 'absolute', top: 223, left: 20, right: 20, alignItems: 'center' },
  button: {
    width: 162,
    marginLeft: 20,
    height: 55,
    borderRadius: 28,
    backgroundColor: tokens.color.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: tokens.color.purple, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  error: {
    color: tokens.color.error,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  disabled: { opacity: 0.5 },
});
