import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppText as Text } from '../../components/ui/AppText';
import { RoomAction } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { validRoomPassword } from './join';

export function RoomPasswordDialog({
  invalid,
  onSubmit,
  onCancel,
}: {
  invalid: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const valid = validRoomPassword(password);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>{t('joinPasswordTitle')}</Text>
          <Text style={styles.helper}>{t('joinFourDigitPassword')}</Text>
          <TextInput
            testID="room-password"
            accessibilityLabel={t('joinFourDigitPassword')}
            autoFocus
            secureTextEntry
            keyboardType="number-pad"
            autoComplete="off"
            maxLength={4}
            value={password}
            onChangeText={(value) => setPassword(value.replace(/\D/g, '').slice(0, 4))}
            onSubmitEditing={() => {
              if (valid) onSubmit(password);
            }}
            style={styles.input}
          />
          {invalid && (
            <Text accessibilityRole="alert" style={styles.error}>
              {t('voicePasswordInvalid')}
            </Text>
          )}
          <RoomAction
            label={t('joinDeviceEnterRoom')}
            disabled={!valid}
            onPress={() => onSubmit(password)}
          />
          <RoomAction label={t('cancelAction')} onPress={onCancel} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', paddingHorizontal: 24 },
  dialog: { padding: 24, borderRadius: 24, backgroundColor: tokens.color.surface, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.color.foreground },
  helper: { fontSize: 14, color: tokens.color.muted },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 24,
    color: tokens.color.foreground,
    backgroundColor: '#fff',
  },
  error: { fontSize: 12, color: tokens.color.error },
});
