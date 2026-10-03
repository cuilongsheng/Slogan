import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { shareRoomUrl } from '../../services/shareRoom';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';

export function RoomShareAction({ url, dark = false }: { url: string; dark?: boolean }) {
  const [result, setResult] = useState<'copied' | 'shared' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await shareRoomUrl(url);
      setResult(outcome === 'cancelled' ? null : outcome);
    } catch {
      setResult('failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.container}>
      <Text selectable style={[styles.url, dark && styles.darkText]}>{url}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void share()}>
        <Text style={styles.action}>{t('roomShareAction')}</Text>
      </TouchableOpacity>
      {result && (
        <Text accessibilityRole={result === 'failed' ? 'alert' : undefined} style={[styles.feedback, dark && styles.darkText]}>
          {t(result === 'failed' ? 'roomShareFailed' : result === 'copied' ? 'roomShareCopied' : 'roomShareOpened')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  url: { color: tokens.color.muted, fontSize: 12, lineHeight: 19 },
  darkText: { color: '#C8BEE1' },
  action: { color: tokens.color.purple, fontWeight: '700', paddingVertical: 8 },
  feedback: { color: tokens.color.muted, fontSize: 12 },
});
