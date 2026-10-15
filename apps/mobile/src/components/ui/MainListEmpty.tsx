import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';

export function MainListEmpty({
  onRefresh,
  error,
  disabled = false,
  label,
}: {
  onRefresh: () => void;
  error?: string | undefined;
  disabled?: boolean;
  label?: string | undefined;
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
          hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }}
          style={[styles.button, disabled && styles.disabled]}
        >
          <Text style={styles.label}>{label ?? t('refreshAction')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  body: { flex: 1 },
  panel: { position: 'absolute', top: 267, left: 20, right: 20, alignItems: 'center' },
  button: {
    width: 86,
    marginLeft: 20,
    height: 30,
    borderRadius: 15,
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
