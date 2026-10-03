import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { PostRoomLearningApi, type KeywordSummary } from './api';

export function SummaryScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new PostRoomLearningApi(authorized), [authorized]);
  const requestIds = useRef<Record<string, string>>({});
  const [summary, setSummary] = useState<KeywordSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try { setSummary(await api.summary(roomId)); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [api, roomId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function importOne(id: string) {
    if (importing || imported.has(id)) return;
    requestIds.current[id] ??= randomUUID();
    setImporting(id);
    setImportError(null);
    try {
      await api.importItem(id, requestIds.current[id]);
      setImported((current) => new Set(current).add(id));
    } catch { setImportError(id); }
    finally { setImporting(null); }
  }

  return <RoomPage ambient>
    <RoomHeader title={t('summaryTitle')} subtitle={t('summarySubtitle')} onBack={() => router.back()} />
    <ScrollView contentContainerStyle={styles.scroll}>
      {loading && !summary ? <ActivityIndicator color={tokens.color.purple} /> : null}
      {loadError ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.muted}>{t('summaryLoadFailed')}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>{t('retry')}</Text></TouchableOpacity></View> : null}
      {summary ? <>
        <View style={styles.card}>
          <Text style={styles.topic}>{summary.topic}</Text>
          <Text style={styles.muted}>{summary.status === 'READY' ? t('summaryReady') : summary.status === 'PENDING' ? t('summaryPending') : summary.status === 'DISABLED' ? t('summaryDisabled') : t('summaryUnavailable')}</Text>
          {summary.status === 'PENDING' ? <TouchableOpacity accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>{t('summaryRefresh')}</Text></TouchableOpacity> : null}
        </View>
        {summary.status === 'READY' ? <>
          <Text style={styles.section}>{t('summaryItems')}</Text>
          {summary.items.length === 0 ? <Text style={styles.muted}>{t('summaryNoItems')}</Text> : summary.items.map((item) => <View key={item.id} style={styles.card}>
            <Text style={styles.kind}>{item.kind === 'KEYWORD' ? t('vocabularyKeyword') : t('vocabularyExpression')}</Text>
            <Text style={styles.word}>{item.text}</Text>
            {importError === item.id ? <Text accessibilityRole="alert" style={styles.error}>{t('summaryImportFailed')}</Text> : null}
            <TouchableOpacity accessibilityRole="button" disabled={importing !== null || imported.has(item.id)} onPress={() => void importOne(item.id)}><Text style={[styles.link, imported.has(item.id) && styles.muted]}>{imported.has(item.id) ? t('summaryImported') : importing === item.id ? t('submitting') : t('summaryImport')}</Text></TouchableOpacity>
          </View>)}
        </> : null}
      </> : null}
    </ScrollView>
  </RoomPage>;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 90, gap: 12 },
  card: { borderWidth: 1, borderColor: tokens.color.border, borderRadius: tokens.radius.lg, backgroundColor: tokens.color.panel, padding: 18 },
  topic: { color: tokens.color.foreground, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  muted: { color: tokens.color.muted, fontSize: 13, lineHeight: 20 },
  section: { color: tokens.color.foreground, fontSize: 17, fontWeight: '700', marginTop: 12 },
  kind: { color: tokens.color.purple, fontSize: 12, fontWeight: '700' },
  word: { color: tokens.color.foreground, fontSize: 19, fontWeight: '700', marginTop: 8 },
  link: { color: tokens.color.purple, fontSize: 13, fontWeight: '700', marginTop: 14 },
  error: { color: tokens.color.error, fontSize: 12, marginTop: 8 },
});
