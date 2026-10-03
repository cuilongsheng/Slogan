import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import type { VoiceRoomApi } from './api';

type Result = Awaited<ReturnType<VoiceRoomApi['extend']>>;

export function RoomExtensionSheet({
  roomId,
  remainingMinutes,
  api,
  onUpdated,
  onRefresh,
  onClose,
}: {
  roomId: string;
  remainingMinutes: number;
  api: VoiceRoomApi;
  onUpdated: (result: Result) => void;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState<15 | 30 | 60>(15);
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const result = await api.extend(roomId, minutes, requestId);
      onUpdated(result);
      onClose();
      await onRefresh();
    } catch {
      setError(true);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <Text style={styles.title}>{t('roomExtendConfirm')}</Text>
        <Text style={styles.body}>{tf('roomRemainingMinutes', { minutes: remainingMinutes })}</Text>
        <View style={styles.options}>
          {([15, 30, 60] as const).map((value) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: minutes === value }}
              style={[styles.option, minutes === value && styles.selected]}
              onPress={() => {
                setMinutes(value);
                setRequestId(randomUUID());
                setError(false);
              }}
            >
              <Text style={styles.optionText}>{tf('roomExtendMinutes', { minutes: value })}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {error && <Text accessibilityRole="alert" style={styles.error}>{t('roomExtendFailed')}</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => void submit()}>
          <Text style={styles.primaryText}>{t('roomExtendSubmit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onClose}>
          <Text style={styles.cancel}>{t('cancelAction')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0008', justifyContent: 'flex-end', zIndex: 21 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: tokens.color.surface, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 50 },
  title: { color: tokens.color.foreground, fontSize: 21, fontWeight: '700' },
  body: { color: tokens.color.muted, fontSize: 13, marginTop: 17, marginBottom: 24 },
  options: { gap: 8, marginBottom: 24 },
  option: { minHeight: 43, borderRadius: 16, backgroundColor: '#EEE9F7', justifyContent: 'center', paddingHorizontal: 14 },
  selected: { borderWidth: 2, borderColor: tokens.color.purple },
  optionText: { color: tokens.color.foreground, fontSize: 13 },
  error: { color: '#C6384A', marginBottom: 12 },
  primary: { minHeight: 54, borderRadius: 14, backgroundColor: tokens.color.purple, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancel: { color: tokens.color.purple, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 22 },
});
